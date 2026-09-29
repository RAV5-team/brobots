import { describe, expect, it } from 'vitest'
import { OPERATION_CLASSES } from '@/mocks/fixtures/operationClasses'
import { PROCESSES } from '@/mocks/fixtures/processes'
import { ROBOTS } from '@/mocks/fixtures/robots'
import {
  EMPTY_ROBOT_FORM,
  REQUIRED_TOTAL,
  classChipHint,
  classesHint,
  filledRequired,
  isRobotForm,
  railNote,
  solutionTypeOptions,
  toNewRobot,
  validateRobotForm,
  type RobotForm,
} from './robotForm'

/** Карточка макета А2 (15966:5992): AMR 800, но под другим названием — AMR 800 уже есть в каталоге. */
const FILLED: RobotForm = {
  ...EMPTY_ROBOT_FORM,
  name: 'AMR 900',
  manufacturer: 'ООО «Морос»',
  readiness: 'operation',
  trl: '9',
  price: '1 800 000',
  solutionType: 'Мобильные роботы|AMR',
  classes: ['OP-01', 'OP-08'],
  payloadKg: '800',
  maxSpeedMps: '2',
  autonomyH: '24',
  chargeTimeMin: '60',
  dimensions: '940 × 640 × 230',
  minTempC: '5',
  avgPowerKw: '1',
  loadUnload: '45 / 45',
  handlingMethod: 'platform',
  indoor: 'yes',
  outdoor: 'no',
  confidence: 'partial',
  sourceText: 'по аналогу AMR 1500, описание каталога',
}

describe('validateRobotForm (PRD 6.3)', () => {
  it('accepts the card from the mockup', () => {
    expect(validateRobotForm(FILLED, ROBOTS)).toEqual({})
  })

  it('requires the starred fields and at least one operation class', () => {
    const errors = validateRobotForm(EMPTY_ROBOT_FORM, ROBOTS)
    expect(Object.keys(errors).sort()).toEqual(['classes', 'manufacturer', 'name', 'price', 'readiness', 'solutionType', 'trl'])
  })

  it('leaves technical parameters optional but checks their format', () => {
    const errors = validateRobotForm({ ...FILLED, payloadKg: 'много', dimensions: '940 × 640', loadUnload: '45', minTempC: '-25' }, ROBOTS)
    expect(Object.keys(errors).sort()).toEqual(['dimensions', 'loadUnload', 'payloadKg'])
  })

  it('checks УГТ is a whole number 1–9 and the price is positive', () => {
    const errors = validateRobotForm({ ...FILLED, trl: '10', price: '0' }, ROBOTS)
    expect(errors.trl).toMatch(/1 до 9/)
    expect(errors.price).toBeDefined()
    expect(validateRobotForm({ ...FILLED, trl: '7,5' }, ROBOTS).trl).toBeDefined()
  })

  it('rejects a robot already in the catalog (AMR 800 · ООО «Морос» — RB-0008)', () => {
    const errors = validateRobotForm({ ...FILLED, name: 'amr 800' }, ROBOTS)
    expect(errors.name).toContain('RB-0008')
  })
})

describe('toNewRobot', () => {
  it('parses numbers with spaces and commas, dimensions and load / unload', () => {
    const robot = toNewRobot({ ...FILLED, maxSpeedMps: '1,5' }, ['amr900_front.jpg'])
    expect(robot).toMatchObject({
      name: 'AMR 900',
      type: 'Мобильные роботы',
      subtype: 'AMR',
      readiness: 'operation',
      trl: 9,
      priceRub: 1_800_000,
      operationClasses: [{ code: 'OP-01' }, { code: 'OP-08' }],
      photos: ['amr900_front.jpg'],
      specs: {
        payloadKg: 800, maxSpeedMps: 1.5, lengthMm: 940, widthMm: 640, heightMm: 230,
        loadTimeS: 45, unloadTimeS: 45, handlingMethod: 'platform', indoor: true, outdoor: false, confidence: 'partial',
      },
    })
  })

  it('omits empty technical parameters and marks unknown confidence as unconfirmed', () => {
    const robot = toNewRobot({ ...FILLED, payloadKg: '', dimensions: '', indoor: '', confidence: '' }, [])
    expect(robot.specs).not.toHaveProperty('payloadKg')
    expect(robot.specs).not.toHaveProperty('lengthMm')
    expect(robot.specs).not.toHaveProperty('indoor')
    expect(robot.specs.confidence).toBe('unconfirmed')
  })
})

describe('filledRequired (панель «Обязательные поля», PRD 15 · №34)', () => {
  it('counts nine starred positions; the id is always filled', () => {
    expect(REQUIRED_TOTAL).toBe(9)
    expect(filledRequired(EMPTY_ROBOT_FORM, 0)).toBe(1)
    expect(filledRequired(FILLED, 1)).toBe(9)
    expect(filledRequired(FILLED, 0)).toBe(8)
  })
})

describe('classesHint (подсказка под классами, PRD 15 · №33)', () => {
  it('lists every library process of the checked classes: six for OP-01 and OP-08', () => {
    const hint = classesHint(['OP-01', 'OP-08'], PROCESSES)
    expect(hint).toBe(
      'Отмечено 2\u00a0класса. Робот попадёт в подбор для 6\u00a0процессов справочника: перемещение паллет, перемещение багажа, '
      + 'доставка бортпитания, доставка питания по отделениям, транспорт белья, доставка биоматериалов',
    )
  })

  it('says so when nothing is checked or no process has the class', () => {
    expect(classesHint([], PROCESSES)).toBe('Отметьте хотя бы один класс — без него робот не попадёт в подбор')
    expect(classesHint(['OP-10'], PROCESSES)).toBe('Отмечен 1\u00a0класс. В справочнике пока нет процессов с этим классом — робот появится в подборе, когда они будут добавлены')
  })
})

describe('railNote', () => {
  it('names the checked codes', () => {
    expect(railNote(['OP-01', 'OP-08'])).toBe('После сохранения робот появится в «Каталоге» и в подборе для процессов с классами OP-01 и OP-08')
    expect(railNote(['OP-01', 'OP-03', 'OP-08'])).toContain('OP-01, OP-03 и OP-08')
    expect(railNote(['OP-02'])).toContain('с классом OP-02')
    expect(railNote([])).toBe('После сохранения робот появится в «Каталоге»')
  })
})

describe('solutionTypeOptions', () => {
  it('takes distinct type · subtype pairs from the catalog', () => {
    const options = solutionTypeOptions(ROBOTS)
    expect(options).toContainEqual({ value: 'Мобильные роботы|AMR', label: 'Мобильные роботы · AMR' })
    expect(new Set(options.map((o) => o.value)).size).toBe(options.length)
  })
})

describe('isRobotForm (черновик из браузера)', () => {
  it('accepts a saved form and rejects foreign data', () => {
    expect(isRobotForm(JSON.parse(JSON.stringify(FILLED)))).toBe(true)
    expect(isRobotForm({ name: 'x' })).toBe(false)
    expect(isRobotForm(null)).toBe(false)
  })

  it('rejects classes that are not operation class codes', () => {
    expect(isRobotForm({ ...FILLED, classes: ['OP-01', 1] })).toBe(false)
    expect(isRobotForm({ ...FILLED, classes: ['Перемещение'] })).toBe(false)
  })
})

describe('classChipHint', () => {
  it('uses the short hint of the mockup and falls back to the class description', () => {
    const op01 = OPERATION_CLASSES[0]
    if (!op01) throw new Error('нет OP-01')
    expect(classChipHint(op01)).toBe('паллеты, тележки, короба')
    expect(classChipHint({ ...op01, code: 'OP-11', description: 'Буксировка прицепов' })).toBe('буксировка прицепов')
  })
})
