package domain

// Option is a code with a Russian label for dropdowns.
type Option struct {
	Code string `json:"code"`
	Name string `json:"name"`
	Hint string `json:"hint,omitempty"`
}

// Codes returns the codes of the options.
func Codes(opts []Option) []string {
	out := make([]string, len(opts))
	for i, o := range opts {
		out[i] = o.Code
	}
	return out
}

// Label returns the label of a code or the code itself.
func Label(opts []Option, code string) string {
	for _, o := range opts {
		if o.Code == code {
			return o.Name
		}
	}
	return code
}

// Static dictionaries; editable dictionaries live in the database.
var (
	SolutionKinds = []Option{
		{Code: "robot", Name: "Роботы"},
		{Code: "infrastructure", Name: "Инфраструктура"},
		{Code: "software", Name: "ПО и интеграции"},
		{Code: "service", Name: "Сервисы внедрения"},
		{Code: "support", Name: "Поддержка"},
	}
	SolutionStatuses = []Option{
		{Code: "operation", Name: "В эксплуатации"},
		{Code: "piloting", Name: "Пилот"},
		{Code: "rnd", Name: "НИОКР"},
	}
	ProductClasses = []Option{
		{Code: "brs", Name: "БРС"},
		{Code: "bas", Name: "БАС"},
		{Code: "software", Name: "ПО"},
	}
	SpecsConfirmation = []Option{
		{Code: "yes", Name: "Подтверждены"},
		{Code: "partial", Name: "Частично"},
		{Code: "no", Name: "Не подтверждены"},
	}
	CapabilityEnvironments = []Option{
		{Code: "indoor", Name: "Помещение"},
		{Code: "outdoor", Name: "Улица"},
		{Code: "both", Name: "Помещение и улица"},
	}
	TaskEnvironments = []Option{
		{Code: "indoor", Name: "Помещение"},
		{Code: "outdoor", Name: "Улица"},
	}
	AcquisitionModels = []Option{
		{Code: "purchase", Name: "Покупка"},
		{Code: "raas", Name: "Роботы как услуга (RaaS)"},
		{Code: "leasing", Name: "Лизинг"},
		{Code: "rent", Name: "Аренда"},
	}
	CostTypes = []Option{
		{Code: "capex", Name: "CAPEX"},
		{Code: "opex_year", Name: "OPEX в год"},
		{Code: "percent", Name: "Процент от CAPEX"},
	}
	PriceUnits = []Option{
		{Code: "item", Name: "за единицу"},
		{Code: "year", Name: "в год"},
		{Code: "percent_capex", Name: "% CAPEX"},
	}
	PriceBands = []Option{
		{Code: "lte1m", Name: "до 1 млн ₽"},
		{Code: "1to3m", Name: "1–3 млн ₽"},
		{Code: "gt3m", Name: "от 3 млн ₽"},
	}
	SourceTypes = []Option{
		{Code: "specs", Name: "ТТХ решений"},
		{Code: "prices", Name: "Цены и условия поставки"},
		{Code: "cases", Name: "Кейсы внедрений"},
		{Code: "norms", Name: "Нормативы и допущения"},
		{Code: "dataset", Name: "Демо-датасет объекта"},
		{Code: "catalog", Name: "Каталог решений"},
	}
	SourceOrigins = []Option{
		{Code: "organizer", Name: "Данные организатора"},
		{Code: "open", Name: "Открытый источник"},
		{Code: "vendor", Name: "Данные поставщика"},
		{Code: "internal", Name: "Внутренний справочник"},
	}
	DataStatuses = []Option{
		{Code: "confirmed", Name: "Подтверждено"},
		{Code: "estimate", Name: "Оценка"},
	}
	RefreshSchedules = []Option{
		{Code: "manual", Name: "Только вручную"},
		{Code: "daily", Name: "Раз в сутки"},
		{Code: "weekly", Name: "Раз в неделю"},
		{Code: "biweekly", Name: "Раз в две недели"},
		{Code: "monthly", Name: "Раз в месяц"},
		{Code: "quarterly", Name: "Раз в квартал"},
	}
	ProjectStatuses = []Option{
		{Code: "draft", Name: "Черновик"},
		{Code: "saved", Name: "Сохранён"},
	}
	ValueSources = []Option{
		{Code: "user", Name: "Введено пользователем"},
		{Code: "default", Name: "Базовое значение организатора"},
		{Code: "file", Name: "Из файла"},
		{Code: "organizer", Name: "Задано организатором"},
		{Code: "formula", Name: "Посчитано по формуле"},
		{Code: "assumption", Name: "Допущение"},
		{Code: "location", Name: "Из локации"},
		{Code: "process_default", Name: "Значение по умолчанию процесса"},
	}
	MatchStates = []Option{
		{Code: "passed", Name: "Проходит жёсткие проверки"},
		{Code: "needs_verification", Name: "Требует проверки"},
		{Code: "excluded", Name: "Исключено"},
	}
	NavigationTypes = []Option{
		{Code: "slam_lidar", Name: "SLAM (лидар)"},
		{Code: "vslam", Name: "VSLAM"},
		{Code: "qr", Name: "QR-метки"},
		{Code: "magnetic", Name: "Магнитная лента"},
		{Code: "gnss", Name: "GNSS"},
		{Code: "combined", Name: "Комбинированная"},
	}
)
