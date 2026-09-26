"""Расписание склада: рабочее окно и пики по потокам (приёмка / отгрузка).

Зачем: расчёт подбора знает только коэффициент пика (макс. час / средний час).
Но число роботов определяется тем, СКЛАДЫВАЮТСЯ ли пики приёмки и отгрузки, а
число станций — тем, есть ли у роботов «окна» для зарядки между пиками. Эти две
вещи задаются только расписанием.

Правило построения профиля по каждому потоку f, где V_f — рейсов в сутки,
H — рабочих часов, k — коэффициент пика, P_f — число пиковых часов потока:
    средний час      avg_f = V_f / H
    пиковый час      k · avg_f
    непиковый час    (V_f − k · avg_f · P_f) / (H − P_f)
Суточный объём сохраняется точно; пики не могут занимать больше H/k часов (иначе
непиковый поток < 0).
"""

from __future__ import annotations

import dataclasses


@dataclasses.dataclass
class PeakWindow:
    """Пик одного потока.

    Attributes:
        flow: "in" — приёмка, "out" — отгрузка.
        start_h: Начало по часам склада, 0–23.
        dur_h: Длительность, ч.
    """

    flow: str
    start_h: int
    dur_h: int


@dataclasses.dataclass
class Schedule:
    """Расписание смен и пиков: раскладывает суточный объём по часам."""

    start_h: int = 7  # начало первой смены
    shifts: int = 2
    shift_h: int = 11
    peak_k: float = 1.5  # во сколько раз пиковый час больше среднего (датасет)
    peaks: list[PeakWindow] = dataclasses.field(default_factory=list)

    @property
    def hours(self) -> int:
        """Рабочих часов в сутках (не больше 24)."""
        return min(24, int(self.shifts * self.shift_h))

    def clock(self, i: int) -> int:
        """Час суток для i-го часа работы."""
        return (self.start_h + i) % 24

    def peak_mask(self, flow: str) -> list[bool]:
        """Пиковые ли рабочие часы для потока flow."""
        mask = [False] * self.hours
        for p in self.peaks:
            if p.flow != flow:
                continue
            for d in range(int(p.dur_h)):
                h = (p.start_h + d) % 24
                i = (h - self.start_h) % 24
                if i < self.hours:
                    mask[i] = True
        return mask

    def outside(self) -> list[str]:
        """Пиковые часы, попавшие вне рабочего окна (ошибка ввода)."""
        bad = []
        for p in self.peaks:
            for d in range(int(p.dur_h)):
                h = (p.start_h + d) % 24
                if (h - self.start_h) % 24 >= self.hours:
                    bad.append(f"{h:02d}:00")
        return sorted(set(bad))

    def hourly(
        self, in_day: float, out_day: float
    ) -> tuple[list[float], list[float], list[str], list[str]]:
        """Считает рейсы в час по приёмке и отгрузке для рабочих часов.

        Args:
            in_day: Рейсов приёмки в сутки.
            out_day: Рейсов отгрузки в сутки.

        Returns:
            (приёмка по часам, отгрузка по часам, ошибки, предупреждения).
            Ошибки делают расписание непригодным: пик занимает всё окно или
            не помещается при заданном коэффициенте. Предупреждения — нет.
        """
        hours, k = self.hours, self.peak_k
        errors: list[str] = []
        warnings: list[str] = []
        rates = {}
        for flow, volume_day, name in (
            ("in", in_day, "приёмки"),
            ("out", out_day, "отгрузки"),
        ):
            m = self.peak_mask(flow)
            peak_hours = sum(m)
            avg = volume_day / hours if hours else 0.0
            if peak_hours == 0:
                rates[flow] = [avg] * hours
                continue
            if peak_hours >= hours:
                errors.append(
                    f"Пик {name} занимает всё рабочее время — это уже не пик. "
                    f"Оставьте пиковыми не больше {int(hours / k)} ч."
                )
                rates[flow] = [avg] * hours
                continue
            off = (volume_day - k * avg * peak_hours) / (hours - peak_hours)
            if off < 0:
                errors.append(
                    f"Пики {name} слишком длинные: при коэффициенте {k:g} "
                    f"пиковых часов может быть не больше "
                    f"{int(hours / k)} из {hours}. Сейчас {peak_hours}."
                )
                off = 0.0
            rates[flow] = [k * avg if m[i] else off for i in range(hours)]
        bad = self.outside()
        if bad:
            warnings.append(
                "Пиковые часы вне рабочего времени не учитываются: "
                + ", ".join(bad)
                + "."
            )
        return rates["in"], rates["out"], errors, warnings


def dataset_schedule(
    start_h: int = 7,
    shifts: int = 2,
    shift_h: int = 11,
    peak_k: float = 1.5,
    offset_h: int = 1,
    dur_h: int = 3,
) -> Schedule:
    """Расписание как в расчёте подбора: пики приёмки и отгрузки совпадают.

    В каждой смене пик начинается через offset_h после её начала.
    """
    peaks = []
    for s in range(shifts):
        st = (start_h + s * shift_h + offset_h) % 24
        peaks += [PeakWindow("in", st, dur_h), PeakWindow("out", st, dur_h)]
    return Schedule(start_h, shifts, shift_h, peak_k, peaks)
