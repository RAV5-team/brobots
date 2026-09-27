package mock

// Norms of the mock model. Every norm a result uses appears in its trace with source "norm".
const (
	utilization      = 0.8     // доля времени робота в работе
	availability     = 0.95    // техническая готовность
	fleetReserve     = 0.15    // резерв парка
	handlingTimeS    = 30.0    // погрузка или разгрузка, если в ТТХ нет
	robotsPerCharger = 4.0     // роботов на станцию, если нет автономности и времени зарядки
	chargerPriceRub  = 350_000 // зарядная станция, ₽
	sitePrepShare    = 0.05    // подготовка объекта, доля стоимости парка
	serviceShare     = 0.08    // обслуживание в год, доля стоимости парка
	softwareShare    = 0.05    // ПО в год, доля стоимости парка
	robotPowerKw     = 0.5     // средняя мощность, если в ТТХ нет
	energyTariffRub  = 7.0     // ₽ за кВт·ч
	raasRentShare    = 0.35    // аренда робота в год, доля его цены
	shiftHours       = 8.0     // часов в смене операторов флота
	daysPerYear      = 365.0
	horizonYears     = 5 // горизонт, если в запросе не задан
)
