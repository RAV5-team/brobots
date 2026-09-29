// Command openapi generates the OpenAPI 3 contract of the api service from its Go types.
//
//	go run ./tools/openapi -out ../../packages/contracts/openapi/api.yaml -copy internal/apispec/openapi.yaml
//
// Run from services/api. CI regenerates the file and fails if it differs from the committed one.
package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"
	"reflect"
	"strings"

	"github.com/brobots/api/internal/domain"
	"github.com/brobots/api/internal/matching"
	"github.com/brobots/api/internal/service"
	"github.com/google/uuid"
	"github.com/swaggest/jsonschema-go"
	"github.com/swaggest/openapi-go"
	"github.com/swaggest/openapi-go/openapi3"
)

func main() {
	out := flag.String("out", "", "output file")
	copyTo := flag.String("copy", "", "second output file (embedded copy)")
	flag.Parse()
	spec, err := Build()
	if err != nil {
		fmt.Fprintln(os.Stderr, "openapi:", err)
		os.Exit(1)
	}
	for _, path := range []string{*out, *copyTo} {
		if path == "" {
			continue
		}
		if err := os.WriteFile(path, spec, 0o644); err != nil {
			fmt.Fprintln(os.Stderr, "openapi:", err)
			os.Exit(1)
		}
	}
	if *out == "" {
		if _, err := os.Stdout.Write(spec); err != nil {
			fmt.Fprintln(os.Stderr, "openapi:", err)
			os.Exit(1)
		}
	}
}

// Response wrappers and pages with stable schema names.
type (
	WorkTypeList struct {
		Items []domain.WorkType `json:"items"`
	}
	DataSourceList struct {
		Items []domain.DataSource `json:"items"`
	}
	CapabilityList struct {
		Items []domain.Capability `json:"items"`
	}
	ProcessList struct {
		Items []domain.Process `json:"items"`
	}
	DefinitionList struct {
		Items []domain.ParameterDefinition `json:"items"`
	}
	TemplateList struct {
		Items []service.LocationTemplate `json:"items"`
	}
	StaffGroupList struct {
		Items []domain.StaffGroup `json:"items"`
	}
	TaskList struct {
		Items []domain.Task `json:"items"`
	}
	ConditionList struct {
		Items []matching.Condition `json:"items"`
	}
	ManualList struct {
		Items []domain.ManualCandidate `json:"items"`
	}
	VersionList struct {
		Items []domain.ReferenceVersion `json:"items"`
	}
	NormSetList struct {
		Items []domain.NormSetSummary `json:"items"`
	}
	SolutionPage struct {
		Items []domain.SolutionSummary `json:"items"`
		Total int                      `json:"total"`
	}
	LocationPage struct {
		Items []domain.Location `json:"items"`
		Total int               `json:"total"`
	}
	ProjectPage struct {
		Items []domain.Project `json:"items"`
		Total int              `json:"total"`
	}
	Dictionaries     map[string][]domain.Option
	DeleteTaskResult struct {
		Archived bool `json:"archived" description:"true — задача используется в проектах и скрыта, false — удалена"`
	}
	Health struct {
		Status  string `json:"status"`
		Version string `json:"version,omitempty"`
	}
	// AuthError is the 401/403 body of docs/keycloak/middleware.md.
	AuthError struct {
		Code    string `json:"code" enum:"unauthorized,forbidden"`
		Message string `json:"message" description:"Что случилось и как исправить, на русском"`
	}
	Problem struct {
		Type   string              `json:"type"`
		Title  string              `json:"title"`
		Status int                 `json:"status"`
		Detail string              `json:"detail,omitempty"`
		Code   string              `json:"code,omitempty"`
		Errors []domain.FieldError `json:"errors,omitempty"`
	}
)

// Request shapes: path and query parameters plus an optional JSON body.
type (
	idPath struct {
		ID string `path:"id" format:"uuid"`
	}
	jobPath struct {
		JobID string `path:"jobId" pattern:"^[0-9a-f]{32}$"`
	}
	capPath struct {
		ID    string `path:"id" format:"uuid"`
		CapID string `path:"capId" format:"uuid"`
	}
	manualPath struct {
		ID         string `path:"id" format:"uuid"`
		SolutionID string `path:"solutionId" format:"uuid"`
	}
	codePath struct {
		Code string `path:"code" enum:"warehouse,airport,medical,custom"`
	}
	hiddenQuery struct {
		IncludeHidden bool `query:"includeHidden" description:"Показать скрытые записи"`
	}
	solutionsQuery struct {
		Kind            string   `query:"kind" enum:"robot,infrastructure,software,service,support" description:"Вкладка каталога"`
		Q               string   `query:"q" description:"Поиск по названию, производителю, коду"`
		WorkTypeID      []string `query:"workTypeId" description:"Классы операций, через запятую"`
		Industry        []string `query:"industry" description:"Отрасли (названия), через запятую"`
		FacilityType    string   `query:"facilityType" description:"Тип объекта: через процессы, применимые к нему"`
		Status          []string `query:"status" description:"operation, piloting, rnd"`
		TrlMin          int      `query:"trlMin" minimum:"1" maximum:"9"`
		PriceBand       string   `query:"priceBand" enum:"lte1m,1to3m,gt3m" description:"Граница относится к нижнему диапазону"`
		CostType        string   `query:"costType" enum:"capex,opex"`
		HasCapabilities bool     `query:"hasCapabilities" description:"Есть хотя бы один класс операции"`
		SpecsConfirmed  []string `query:"specsConfirmed" description:"yes, partial, no"`
		IncludeHidden   bool     `query:"includeHidden"`
		Sort            string   `query:"sort" enum:"relevance,price_asc,price_desc,trl,confirmation,updated,name"`
		Limit           int      `query:"limit" default:"50" maximum:"500"`
		Offset          int      `query:"offset"`
	}
	compareQuery struct {
		IDs []string `query:"ids" required:"true" description:"2–6 идентификаторов через запятую"`
	}
	processesQuery struct {
		Q             string `query:"q"`
		WorkTypeID    string `query:"workTypeId" format:"uuid"`
		FacilityType  string `query:"facilityType"`
		Category      string `query:"category" description:"Вид работ"`
		IsCustom      bool   `query:"isCustom"`
		IncludeHidden bool   `query:"includeHidden"`
	}
	locationsQuery struct {
		Q            string `query:"q" description:"Название, город, тип объекта"`
		FacilityType string `query:"facilityType"`
		Completeness string `query:"completeness" enum:"complete,has_assumptions,has_missing"`
		Projects     string `query:"projects" enum:"has_completed,drafts,none"`
		Sort         string `query:"sort" enum:"updated,name,completeness,projects,labor_cost"`
		Limit        int    `query:"limit" default:"50"`
		Offset       int    `query:"offset"`
	}
	projectsQuery struct {
		LocationID string `query:"locationId" format:"uuid"`
		TaskID     string `query:"taskId" format:"uuid"`
		Status     string `query:"status" enum:"draft,saved"`
		Q          string `query:"q"`
		Sort       string `query:"sort" enum:"updated,name"`
		Limit      int    `query:"limit" default:"50"`
		Offset     int    `query:"offset"`
	}
	dryRunQuery struct {
		ID     string `path:"id" format:"uuid"`
		DryRun bool   `query:"dryRun" description:"Только посчитать значения задачи, не сохранять"`
	}
	workTypeIDsBody struct {
		ID          string      `path:"id" format:"uuid"`
		WorkTypeIDs []uuid.UUID `json:"workTypeIds"`
	}
	parametersBody struct {
		ID    string                  `path:"id" format:"uuid"`
		Items []domain.ParameterInput `json:"items"`
	}
	staffBody struct {
		ID    string                    `path:"id" format:"uuid"`
		Items []service.StaffGroupInput `json:"items"`
	}
	conditionsBody struct {
		ID    string              `path:"id" format:"uuid"`
		Items []matching.Override `json:"items"`
	}
)

type op struct {
	method, path, tag, summary, description string
	req                                     any
	body                                    any
	resp                                    any
	status                                  int
	errors                                  []int
}

// Operations lists every route of the router; router_test.go checks they match.
func Operations() []op {
	notFound := []int{404}
	withBody := []int{422}
	withBodyNF := []int{404, 409, 422}
	draftOnly := []int{404, 409} // 409 project_saved: a saved project is frozen
	return []op{
		{http.MethodGet, "/healthz", "service", "Живость сервиса", "", nil, nil, new(Health), 200, nil},
		{http.MethodGet, "/readyz", "service", "Готовность: доступность базы", "", nil, nil, new(Health), 200, []int{503}},
		{http.MethodGet, "/api/v1/dictionaries", "dictionaries", "Все справочники для выпадающих списков", "", nil, nil, new(Dictionaries), 200, nil},
		{http.MethodGet, "/api/v1/versions", "dictionaries", "Текущие версии каталога и справочников", "Для строки «Версия данных» и закрепления в проекте (ТЗ 3.1.5).", nil, nil, new(VersionList), 200, nil},
		{http.MethodGet, "/api/v1/dashboard/summary", "dashboard", "Сводка дашборда", "foundSavingsRubYear — сумма годового эффекта сохранённых оценок (resultSummary); null — сохранённых оценок с эффектом нет.", nil, nil, new(domain.Dashboard), 200, nil},

		{http.MethodGet, "/api/v1/norms", "norms", "Текущие нормативы расчёта", "Экран А5 (PRD 6.8): значение, единица, тип (норматив или допущение) и источник каждого норматива. Новые проекты закрепляют эту версию. Доли — от 0 до 1, веса рейтинга — в процентах, в сумме 100.", nil, nil, new(domain.NormSet), 200, notFound},
		{http.MethodGet, "/api/v1/norm-sets", "norms", "Версии нормативов", "Новые сверху.", nil, nil, new(NormSetList), 200, nil},
		{http.MethodPost, "/api/v1/norm-sets", "norms", "Сохранить новую версию нормативов", "Переданные значения меняются, остальные берутся из текущей версии. Сохранённые версии не меняются: существующие проекты считаются на своей версии, пока не обновят снимок.", nil, new(service.NormSetInput), new(domain.NormSet), 201, withBody},
		{http.MethodGet, "/api/v1/norm-sets/{id}", "norms", "Версия нормативов", "", new(idPath), nil, new(domain.NormSet), 200, notFound},

		{http.MethodGet, "/api/v1/work-types", "work-types", "Классы операций (ключ подбора)", "Со счётчиками роботов и процессов (экран A8).", new(hiddenQuery), nil, new(WorkTypeList), 200, nil},
		{http.MethodPost, "/api/v1/work-types", "work-types", "Создать класс операции", "Код OP-NN присваивается автоматически (экран A9).", nil, new(service.WorkTypeInput), new(domain.WorkType), 201, []int{409, 422}},
		{http.MethodGet, "/api/v1/work-types/{id}", "work-types", "Класс операции", "", new(idPath), nil, new(domain.WorkType), 200, notFound},
		{http.MethodPatch, "/api/v1/work-types/{id}", "work-types", "Изменить класс операции", "JSON merge patch: переданные поля заменяются, null очищает. Связи идут по id — переименование их не ломает.", new(idPath), new(service.WorkTypeInput), new(domain.WorkType), 200, withBodyNF},
		{http.MethodDelete, "/api/v1/work-types/{id}", "work-types", "Скрыть класс операции", "Класс не удаляется: роботы и процессы продолжают на него ссылаться.", new(idPath), nil, nil, 204, notFound},

		{http.MethodGet, "/api/v1/data-sources", "data-sources", "Источники данных", "Экран A6. Только администратор.", nil, nil, new(DataSourceList), 200, nil},
		{http.MethodPost, "/api/v1/data-sources", "data-sources", "Добавить источник", "Экраны A7/A7б. Загрузка файла и проверка ссылки — вне рамок сервиса.", nil, new(service.DataSourceInput), new(domain.DataSource), 201, withBody},
		{http.MethodGet, "/api/v1/data-sources/{id}", "data-sources", "Источник данных", "", new(idPath), nil, new(domain.DataSource), 200, notFound},
		{http.MethodPatch, "/api/v1/data-sources/{id}", "data-sources", "Изменить источник", "JSON merge patch.", new(idPath), new(service.DataSourceInput), new(domain.DataSource), 200, withBodyNF},
		{http.MethodDelete, "/api/v1/data-sources/{id}", "data-sources", "Удалить источник", "Ссылки из каталога очищаются.", new(idPath), nil, nil, 204, notFound},

		{http.MethodGet, "/api/v1/solutions", "catalog", "Каталог решений", "Фильтры, поиск и сортировка витрины каталога и админского списка (экраны 03/K1, A1).", new(solutionsQuery), nil, new(SolutionPage), 200, []int{400}},
		{http.MethodPost, "/api/v1/solutions", "catalog", "Добавить решение", "Карточка робота или позиции для запуска (экран A2). Правка идёт в следующую версию каталога.", nil, new(service.SolutionInput), new(domain.Solution), 201, []int{409, 422}},
		{http.MethodGet, "/api/v1/solutions/compare", "catalog", "Сравнение решений", "Единая таблица характеристик по группам ТЗ 3.3 (экран compare).", new(compareQuery), nil, new(service.Comparison), 200, []int{404, 422}},
		{http.MethodGet, "/api/v1/solutions/{id}", "catalog", "Карточка решения", "С ТТХ, классами операций, предложениями и числом проектов.", new(idPath), nil, new(domain.Solution), 200, notFound},
		{http.MethodPatch, "/api/v1/solutions/{id}", "catalog", "Изменить решение", "JSON merge patch; spec и price сливаются по полям; workTypeIds заменяет набор классов.", new(idPath), new(service.SolutionInput), new(domain.Solution), 200, withBodyNF},
		{http.MethodDelete, "/api/v1/solutions/{id}", "catalog", "Скрыть решение", "Решение уходит из новых подборов, сохранённые проекты его сохраняют.", new(idPath), nil, nil, 204, notFound},
		{http.MethodGet, "/api/v1/solutions/{id}/capabilities", "catalog", "Классы операций робота", "", new(idPath), nil, new(CapabilityList), 200, notFound},
		{http.MethodPut, "/api/v1/solutions/{id}/capabilities", "catalog", "Задать набор классов робота", "Чипы на карточке A2: новые строки создаются, отсутствующие скрываются.", new(workTypeIDsBody), nil, new(CapabilityList), 200, withBodyNF},
		{http.MethodPost, "/api/v1/solutions/{id}/capabilities", "catalog", "Добавить строку класса с атрибутами", "Производительность, способ обработки, среда, высота подъёма для пары «робот + класс».", new(idPath), new(service.CapabilityInput), new(domain.Capability), 201, withBodyNF},
		{http.MethodPatch, "/api/v1/solutions/{id}/capabilities/{capId}", "catalog", "Изменить строку класса", "JSON merge patch; пустые handlingMethodCode и environment берутся из ТТХ робота.", new(capPath), new(service.CapabilityInput), new(domain.Capability), 200, withBodyNF},
		{http.MethodDelete, "/api/v1/solutions/{id}/capabilities/{capId}", "catalog", "Скрыть строку класса", "", new(capPath), nil, nil, 204, notFound},

		{http.MethodGet, "/api/v1/processes", "processes", "Справочник процессов", "Экран 07: значения по умолчанию, число роботов по классу, число локаций.", new(processesQuery), nil, new(ProcessList), 200, []int{400}},
		{http.MethodPost, "/api/v1/processes", "processes", "Создать процесс", "Экран 09а. Процесс без класса операции не сохраняется. Формулы ссылаются на коды или роли параметров локации.", nil, new(service.ProcessInput), new(domain.Process), 201, []int{409, 422}},
		{http.MethodGet, "/api/v1/processes/{id}", "processes", "Процесс и его задачи на локациях", "Экран 11.", new(idPath), nil, new(domain.ProcessDetail), 200, notFound},
		{http.MethodPatch, "/api/v1/processes/{id}", "processes", "Изменить процесс", "JSON merge patch. Созданные задачи хранят свои копии значений; класс нельзя сменить, если процесс уже на локациях.", new(idPath), new(service.ProcessInput), new(domain.Process), 200, withBodyNF},
		{http.MethodDelete, "/api/v1/processes/{id}", "processes", "Скрыть процесс", "", new(idPath), nil, nil, 204, notFound},
		{http.MethodGet, "/api/v1/processes/{id}/robots", "processes", "Роботы класса процесса", "Предварительная проверка по значениям процесса: проходят / есть ограничения / мало данных (экран 11).", new(idPath), nil, new(service.RobotGroups), 200, notFound},
		{http.MethodPost, "/api/v1/processes/{id}/duplicate", "processes", "Дублировать процесс", "", new(idPath), nil, new(domain.Process), 201, notFound},

		{http.MethodGet, "/api/v1/facility-types/{code}/parameters", "locations", "Параметры типа объекта", "Определения из датасетов организатора: единицы, диапазоны, подсказки, роли для формул.", new(codePath), nil, new(DefinitionList), 200, notFound},
		{http.MethodGet, "/api/v1/locations", "locations", "Локации", "Карточки экрана 12: площадь, персонал, задачи, ручной труд, заполненность, допущения, проекты.", new(locationsQuery), nil, new(LocationPage), 200, []int{400}},
		{http.MethodPost, "/api/v1/locations", "locations", "Создать локацию", "Экран 14. Значения проверяются по типу и диапазону датасета; fillDefaults подставляет базовые значения организатора как допущения.", nil, new(service.LocationInput), new(domain.Location), 201, withBody},
		{http.MethodGet, "/api/v1/locations/templates", "locations", "Типовые объекты", "Демо-локации организатора, которые можно скопировать.", nil, nil, new(TemplateList), 200, nil},
		{http.MethodPost, "/api/v1/locations/from-template", "locations", "Создать локацию из типового объекта", "Копирует параметры, группы персонала и задачи демо-локации.", nil, new(service.FromTemplateInput), new(domain.Location), 201, withBodyNF},
		{http.MethodGet, "/api/v1/locations/{id}", "locations", "Локация", "С группами персонала, сводкой и готовностью профиля.", new(idPath), nil, new(domain.Location), 200, notFound},
		{http.MethodPatch, "/api/v1/locations/{id}", "locations", "Изменить локацию", "JSON merge patch; parameters и staffGroups в теле применяются как upsert.", new(idPath), new(service.LocationInput), new(domain.Location), 200, withBodyNF},
		{http.MethodDelete, "/api/v1/locations/{id}", "locations", "Удалить локацию", "Задачи архивируются, проекты сохраняют снимок и получают locationDeleted.", new(idPath), nil, nil, 204, notFound},
		{http.MethodGet, "/api/v1/locations/{id}/parameters", "locations", "Параметры объекта", "Вкладка 17а: определения с значениями, источником и пометкой допущения.", new(idPath), nil, new(domain.LocationParameters), 200, notFound},
		{http.MethodPut, "/api/v1/locations/{id}/parameters", "locations", "Сохранить параметры объекта", "Upsert; value: null очищает значение.", new(parametersBody), nil, new(domain.LocationParameters), 200, withBodyNF},
		{http.MethodPut, "/api/v1/locations/{id}/staff-groups", "locations", "Группы персонала", "Заменяет список групп; группы, которых нет в списке, удаляются вместе с назначениями на задачи.", new(staffBody), nil, new(StaffGroupList), 200, withBodyNF},
		{http.MethodGet, "/api/v1/locations/{id}/tasks", "tasks", "Задачи локации", "Карточки 15/17: значения, готовность «9/9», число роботов, затраты на персонал.", new(idPath), nil, new(TaskList), 200, notFound},
		{http.MethodPost, "/api/v1/locations/{id}/tasks", "tasks", "Добавить задачу из процесса", "Экран 15а: значения берутся из процесса и формул по параметрам локации; params переопределяют их.", new(dryRunQuery), new(service.TaskCreateInput), new(domain.Task), 201, withBodyNF},

		{http.MethodGet, "/api/v1/tasks/{id}", "tasks", "Задача на локации", "Экран 16: значения, источник каждого значения, производные показатели.", new(idPath), nil, new(domain.Task), 200, notFound},
		{http.MethodPatch, "/api/v1/tasks/{id}", "tasks", "Изменить задачу", "params: ключи задают значения (null очищает); assumeDefaults — кнопка «Не знаю»: значение процесса с пометкой допущения.", new(idPath), new(service.TaskPatchInput), new(domain.Task), 200, withBodyNF},
		{http.MethodDelete, "/api/v1/tasks/{id}", "tasks", "Удалить задачу с локации", "Задача из проектов архивируется, иначе удаляется (экран 17в).", new(idPath), nil, new(DeleteTaskResult), 200, notFound},
		{http.MethodGet, "/api/v1/tasks/{id}/match-preview", "matching", "Подходящие роботы для задачи", "Подбор без сохранения по текущим данным задачи (экран 18).", new(idPath), nil, new(matching.Run), 200, notFound},

		{http.MethodGet, "/api/v1/projects", "projects", "Проекты", "", new(projectsQuery), nil, new(ProjectPage), 200, []int{400}},
		{http.MethodPost, "/api/v1/projects", "projects", "Создать проект", "Ровно одна задача. Фиксируется снимок локации и задачи и версии каталога и справочников. pinnedSolutionId — вход «Проверить на своём объекте».", nil, new(service.ProjectCreateInput), new(domain.Project), 201, withBodyNF},
		{http.MethodGet, "/api/v1/projects/{id}", "projects", "Проект", "dataChanged — локация или задача изменились после снимка; catalogUpdated — доступна новая версия каталога.", new(idPath), nil, new(domain.Project), 200, notFound},
		{http.MethodPatch, "/api/v1/projects/{id}", "projects", "Изменить проект", "JSON merge patch: название, горизонт, задача, шаг и решения по шагам (inputs заменяются целиком). Статус меняют save и reopen; у сохранённого проекта меняется только название (409).", new(idPath), new(service.ProjectPatchInput), new(domain.Project), 200, withBodyNF},
		{http.MethodDelete, "/api/v1/projects/{id}", "projects", "Удалить проект", "", new(idPath), nil, nil, 204, notFound},
		{http.MethodPost, "/api/v1/projects/{id}/copy", "projects", "Копировать проект", "Со снимком, условиями и ручными кандидатами.", new(idPath), nil, new(domain.Project), 201, notFound},
		{http.MethodPost, "/api/v1/projects/{id}/refresh-snapshot", "projects", "Обновить снимок", "«Данные изменились — пересчитать»: перечитывает локацию и задачу, снимает выбор робота (его цифры посчитаны на старых данных). Только для черновика.", new(idPath), nil, new(domain.Project), 200, draftOnly},
		{http.MethodGet, "/api/v1/projects/{id}/snapshot", "projects", "Снимок входных данных проекта", "", new(idPath), nil, new(domain.ProjectSnapshot), 200, notFound},
		{http.MethodGet, "/api/v1/projects/{id}/conditions", "matching", "Условия подбора проекта", "Панель 12a: у каждого условия источник — задача, формула, проект или правило.", new(idPath), nil, new(ConditionList), 200, notFound},
		{http.MethodPut, "/api/v1/projects/{id}/conditions", "matching", "Изменить условия подбора в проекте", "Заменяет переопределения; действуют только в этом проекте.", new(conditionsBody), nil, new(ConditionList), 200, withBodyNF},
		{http.MethodDelete, "/api/v1/projects/{id}/conditions", "matching", "Сбросить условия к задаче", "", new(idPath), nil, new(ConditionList), 200, draftOnly},
		{http.MethodPost, "/api/v1/projects/{id}/matching-runs", "matching", "Запустить подбор", "Совпадение класса операции и жёсткие проверки со значениями и причинами; прогон сохраняется. Без расчёта экономики — его делает evaluate.", new(idPath), nil, new(matching.Run), 201, draftOnly},
		{http.MethodGet, "/api/v1/projects/{id}/matching-runs/latest", "matching", "Последний прогон подбора", "", new(idPath), nil, new(matching.Run), 200, notFound},
		{http.MethodGet, "/api/v1/matching-runs/{id}", "matching", "Прогон подбора", "", new(idPath), nil, new(matching.Run), 200, notFound},
		{http.MethodGet, "/api/v1/projects/{id}/manual-candidates", "matching", "Решения, добавленные вручную", "", new(idPath), nil, new(ManualList), 200, notFound},
		{http.MethodPost, "/api/v1/projects/{id}/manual-candidates", "matching", "Добавить решение вручную", "ТЗ 3.4.4: решение проверяется и показывается с предупреждением.", new(idPath), new(service.ManualCandidateInput), new(ManualList), 201, withBodyNF},
		{http.MethodDelete, "/api/v1/projects/{id}/manual-candidates/{solutionId}", "matching", "Убрать решение, добавленное вручную", "", new(manualPath), nil, nil, 204, draftOnly},
		{http.MethodPost, "/api/v1/projects/{id}/evaluate", "orchestrator", "Рассчитать подбор", "Вкладка «Подбор»: подбор по снимку проекта и расчёт парка и экономики каждого кандидата (прошёл, требует проверки, добавлен вручную) для покупки и RaaS. Поля кандидатов замораживаются во входе расчёта. calcOverrides — «Параметры расчёта» проекта (PRD 11.3), заменяют прежние; поля робота относятся к solutionId. Выбор робота переносится на новый расчёт, если вариант снова посчитан, иначе снимается. 503 — сервис расчёта не ответил, прогон подбора при этом сохранён.", new(idPath), new(service.EvaluateInput), new(service.Evaluation), 201, []int{404, 409, 422, 503}},
		{http.MethodGet, "/api/v1/projects/{id}/evaluation", "orchestrator", "Последний расчёт подбора", "Читает сохранённые цифры, калькулятор не вызывается. stale — параметры проекта изменились после расчёта, modelOutdated — ядро расчёта обновилось.", new(idPath), nil, new(service.Evaluation), 200, notFound},
		{http.MethodPut, "/api/v1/projects/{id}/selection", "orchestrator", "Выбрать робота", "Только из результатов последнего актуального расчёта. Поля робота копируются в snapshot.robot из входа расчёта. solutionId: null снимает выбор.", new(idPath), new(service.SelectionInput), new(domain.Project), 200, withBodyNF},
		{http.MethodPost, "/api/v1/projects/{id}/save", "orchestrator", "Сохранить проект", "draft → saved: закрепляет снимок с выбранным роботом, расчёт и версию ядра. Нужен выбор по актуальному расчёту.", new(idPath), nil, new(domain.Project), 200, []int{404, 409}},
		{http.MethodPost, "/api/v1/projects/{id}/reopen", "orchestrator", "Открыть проект для изменений", "saved → draft. Сохранённые расчёты остаются в истории.", new(idPath), nil, new(domain.Project), 200, notFound},
		{http.MethodPost, "/api/v1/projects/{id}/simulation-runs", "simulation", "Запустить симуляцию выбранной конфигурации", "Шаг «Симуляция» (PRD 11.4): вход собирается из снимка проекта, выбранного робота и его расчёта; fleet — состав этапа 1 (пусто — из расчёта), conditions — условия этапа 2. Прогон ставится в очередь services/simulation от имени автора проекта; гость проверяет демо-проект через preview. 409 — вариант не выбран или проект сохранён, 422 — симуляция не приняла вход, 503 — сервис симуляции не ответил.", new(idPath), new(service.SimulationRunInput), new(service.SimulationRun), 201, []int{404, 409, 422, 503}},
		{http.MethodPost, "/api/v1/projects/{id}/preview", "preview", "Расчёт демо-проекта без сохранения", "Гость (роли §5): подбор и расчёт парка и экономики демо-проекта с условиями задачи taskConditions и «Параметрами расчёта» calcOverrides из тела; пусто — как в проекте. Ничего не сохраняется: ни в api, ни в сервисе экономики; идентификаторы в ответе одноразовые. Ответ — как у evaluate. 403 — проект не демо.", new(idPath), new(service.PreviewInput), new(service.Evaluation), 200, []int{403, 404, 422, 503}},
		{http.MethodPost, "/api/v1/projects/{id}/preview/simulation-runs", "preview", "Симуляция демо-проекта без сохранения", "Гость (роли §5): api пересчитывает демо-проект как в preview, берёт вариант solutionId + acquisitionModel и ставит задание в services/simulation от своего имени. В api ничего не сохраняется, задание удаляется в services/simulation через 24 ч. 409 — вариант не посчитан на этих условиях, 429 — демо-симуляций сейчас много.", new(idPath), new(service.PreviewSimulationInput), new(service.PreviewSimulationRun), 201, []int{403, 404, 409, 422, 429, 503}},
		{http.MethodGet, "/api/v1/preview/simulation-runs/{jobId}", "preview", "Ход демо-симуляции", "Задание знают по его id: журнал строками и секунды; done — есть simulationId.", new(jobPath), nil, new(service.PreviewSimulationRun), 200, []int{404, 503}},
		{http.MethodGet, "/api/v1/preview/simulation-runs/{jobId}/result", "preview", "Результат демо-симуляции", "SimulationRun services/simulation как есть.", new(jobPath), nil, new(map[string]any), 200, []int{404, 409, 503}},
		{http.MethodGet, "/api/v1/preview/simulation-runs/{jobId}/traces", "preview", "2D-трассы демо-симуляции", "Как у /simulation-runs/{id}/traces.", new(jobPath), nil, new([]map[string]any), 200, []int{404, 409, 503}},
		{http.MethodGet, "/api/v1/simulation-runs/{id}", "simulation", "Ход прогона симуляции", "Опрашивает задание services/simulation, пока оно в очереди или идёт: журнал строками и секунды. done — есть simulationId, результат и трассы. stale — параметры проекта изменились после запуска.", new(idPath), nil, new(service.SimulationRun), 200, []int{404, 503}},
		{http.MethodDelete, "/api/v1/simulation-runs/{id}", "simulation", "Остановить прогон", "services/simulation не отменяет задание: api помечает прогон cancelled и не читает его результат. 409 — прогон уже завершён.", new(idPath), nil, nil, 204, []int{404, 409}},
		{http.MethodGet, "/api/v1/simulation-runs/{id}/result", "simulation", "Результат прогона", "SimulationRun services/simulation как есть: вердикт, состав было → стало, KPI, загрузка по часам, поправки (services/simulation/docs/openapi.json).", new(idPath), nil, new(map[string]any), 200, []int{404, 409, 503}},
		{http.MethodGet, "/api/v1/simulation-runs/{id}/traces", "simulation", "2D-трассы прогона", "Массив трасс simcore/viz.export_trace для 2D-плеера: из подбора и, если состав изменился, итоговая. С Accept-Encoding: gzip — сжатыми.", new(idPath), nil, new([]map[string]any), 200, []int{404, 409, 503}},
		{http.MethodPost, "/api/v1/projects/{id}/quote-request", "orchestrator", "Запросить коммерческое предложение", "По выбранной конфигурации (08b): отметка quoteRequestedAt. Оценку не меняет — доступно и сохранённому проекту. 409 — вариант не выбран.", new(idPath), nil, new(domain.Project), 200, []int{404, 409}},
		{http.MethodGet, "/api/v1/projects/{id}/evaluation-context", "matching", "Контекст для оркестратора оценки", "Снимок, условия и подходящие кандидаты последнего прогона с полными данными каталога.", new(idPath), nil, new(service.EvaluationContext), 200, notFound},
	}
}

// Access is who may call an operation.
type Access int

// Access levels of the router (internal/handlers/router.go).
const (
	Public Access = iota // no token check: health, readiness
	Guest                // no token or a valid user token
	User                 // a valid user token
	Admin                // a valid user token with the admin role
)

// adminPrefixes hold the catalog and reference data: only the admin changes them.
var adminPrefixes = []string{"/api/v1/work-types", "/api/v1/data-sources", "/api/v1/solutions", "/api/v1/norm-sets"}

// AccessOf is the access policy of an operation; the router test checks the router enforces it.
func AccessOf(method, path string) Access {
	switch {
	case !strings.HasPrefix(path, "/api/v1/"):
		return Public
	case strings.HasPrefix(path, "/api/v1/data-sources"):
		return Admin // the source registry is part of the admin section, reading too (roles model §4)
	case strings.Contains(path, "/preview"):
		return Guest // a guest recalculates a demo project without saving (roles model §5): the service allows demo only
	case method == http.MethodGet:
		return Guest
	case strings.HasPrefix(path, "/api/v1/processes"):
		return User // reference processes need admin, own ones their author: checked by the service
	}
	for _, prefix := range adminPrefixes {
		if strings.HasPrefix(path, prefix) {
			return Admin
		}
	}
	return User
}

// security is the OpenAPI requirement of an access level; {} makes the token optional.
func security(a Access) []map[string][]string {
	bearer := map[string][]string{"bearerAuth": {}}
	switch a {
	case Guest:
		return []map[string][]string{{}, bearer}
	case User, Admin:
		return []map[string][]string{bearer}
	}
	return nil
}

// newReflector creates a reflector with the schema conventions of the service: UUID and date as strings.
func newReflector() *openapi3.Reflector {
	r := openapi3.NewReflector()
	r.Spec = &openapi3.Spec{Openapi: "3.0.3"}
	jr := r.JSONSchemaReflector()
	uuidType := reflect.TypeOf(uuid.UUID{})
	dateType := reflect.TypeOf(domain.Date{})
	jr.DefaultOptions = append(jr.DefaultOptions,
		jsonschema.InterceptSchema(func(p jsonschema.InterceptSchemaParams) (bool, error) {
			t := p.Value.Type()
			for t.Kind() == reflect.Pointer {
				t = t.Elem()
			}
			switch t {
			case uuidType:
				p.Schema.TypeEns().WithSimpleTypes(jsonschema.String)
				p.Schema.WithFormat("uuid")
				p.Schema.Items = nil
				p.Schema.MinItems, p.Schema.MaxItems = 0, nil
				return true, nil
			case dateType:
				p.Schema.TypeEns().WithSimpleTypes(jsonschema.String)
				p.Schema.WithFormat("date")
				p.Schema.Properties = nil
				return true, nil
			}
			return false, nil
		}),
		jsonschema.InterceptDefName(func(t reflect.Type, def string) string {
			name := t.Name()
			if name == "" || strings.Contains(name, "[") {
				return def
			}
			return strings.ToUpper(name[:1]) + name[1:]
		}),
	)
	return r
}

// Build renders the specification.
func Build() ([]byte, error) {
	r := newReflector()
	r.Spec.Info.WithTitle("RAV5 API · локации, каталог, подбор").WithVersion("0.1.0").WithDescription(
		"Сервис api: локации, задачи и проекты; каталог и классы операций; подбор по классу операции и жёсткие проверки.\n\n" +
			"Ошибки — application/problem+json (RFC 7807) с полем errors: поле, код, сообщение и подсказка на русском.\n" +
			"Доступ — access token Keycloak (realm rav5, aud rav5-api) в заголовке Authorization: Bearer. " +
			"Чтение открыто гостю; присланный токен обязан быть валидным. Запись — вошедшему пользователю, " +
			"каталог, классы операций, источники и справочные процессы — роли admin. " +
			"Локации, задачи, проекты и пользовательские процессы принадлежат автору: пользователь видит свои и " +
			"демо-данные, гость — только демо; чужие — 404, изменение демо-данных и справочных процессов без admin — 403. " +
			"401 и 403 — {code, message}; сервисный токен на этих путях — 403.\n" +
			"PATCH — JSON merge patch: переданные поля заменяются, null очищает, вложенные объекты сливаются; неизвестные поля отклоняются.\n" +
			"Доли (automationShare, timeShare и т.п.) — от 0 до 1. Деньги — рубли с НДС.")
	r.Spec.SetHTTPBearerTokenSecurity("bearerAuth", "JWT", "Access token Keycloak realm rav5")
	for _, o := range Operations() {
		oc, err := r.NewOperationContext(o.method, o.path)
		if err != nil {
			return nil, fmt.Errorf("%s %s: %w", o.method, o.path, err)
		}
		oc.SetTags(o.tag)
		oc.SetSummary(o.summary)
		if o.description != "" {
			oc.SetDescription(o.description)
		}
		if o.req != nil {
			oc.AddReqStructure(o.req)
		}
		if o.body != nil {
			oc.AddReqStructure(o.body)
		}
		if o.resp != nil {
			oc.AddRespStructure(o.resp, func(cu *openapi.ContentUnit) { cu.HTTPStatus = o.status })
		} else {
			oc.AddRespStructure(nil, func(cu *openapi.ContentUnit) { cu.HTTPStatus = o.status })
		}
		for _, code := range o.errors {
			oc.AddRespStructure(new(Problem), func(cu *openapi.ContentUnit) {
				cu.HTTPStatus = code
				cu.ContentType = "application/problem+json"
			})
		}
		access := AccessOf(o.method, o.path)
		authErrors := map[Access][]int{Guest: {401, 403}, User: {401, 403}, Admin: {401, 403}}[access]
		for _, code := range authErrors {
			oc.AddRespStructure(new(AuthError), func(cu *openapi.ContentUnit) {
				cu.HTTPStatus = code
				cu.Description = map[int]string{401: "Токен не прислан (где он обязателен), невалиден или просрочен", 403: "Нет нужной роли или прислан сервисный токен"}[code]
			})
		}
		if err := r.AddOperation(oc); err != nil {
			return nil, fmt.Errorf("%s %s: %w", o.method, o.path, err)
		}
		if sec := security(access); sec != nil {
			if err := r.Spec.SetupOperation(o.method, o.path, func(op *openapi3.Operation) error {
				op.Security = sec
				return nil
			}); err != nil {
				return nil, fmt.Errorf("%s %s: %w", o.method, o.path, err)
			}
		}
	}
	return r.Spec.MarshalYAML()
}
