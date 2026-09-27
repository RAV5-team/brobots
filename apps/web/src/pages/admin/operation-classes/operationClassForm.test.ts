import { describe, expect, it } from 'vitest'
import { EMPTY_OPERATION_CLASS_FORM, toNewOperationClass, validateOperationClassForm, type OperationClassForm } from './operationClassForm'

const EXISTING = [{ code: 'OP-01', name: 'Перемещение грузов' }] as const

const filled: OperationClassForm = {
  name: ' Буксировка прицепов ',
  description: 'Перемещение прицепов и тележек между зонами тягачом',
  unit: 'ед. / ч',
  typicalCarriers: 'прицеп,  тележка, ',
  exampleProcesses: 'Буксировка багажных тележек',
}

describe('validateOperationClassForm (PRD 6.7)', () => {
  it('requires name, description and unit', () => {
    expect(validateOperationClassForm(EMPTY_OPERATION_CLASS_FORM, EXISTING)).toEqual({
      name: 'required',
      description: 'required',
      unit: 'required',
    })
  })

  it('accepts a filled form; carriers and examples are optional', () => {
    expect(validateOperationClassForm({ ...filled, typicalCarriers: '', exampleProcesses: '' }, EXISTING)).toEqual({})
  })

  it('flags a name that repeats an existing class, ignoring case, spaces and «ё»', () => {
    const errors = validateOperationClassForm({ ...filled, name: '  перемещение  грузов ' }, EXISTING)
    expect(errors).toEqual({ name: { duplicateOf: 'OP-01' } })
  })
})

describe('toNewOperationClass', () => {
  it('trims values and splits enumerations by comma', () => {
    expect(toNewOperationClass(filled)).toEqual({
      name: 'Буксировка прицепов',
      description: 'Перемещение прицепов и тележек между зонами тягачом',
      unit: 'ед. / ч',
      typicalCarriers: ['прицеп', 'тележка'],
      exampleProcesses: ['Буксировка багажных тележек'],
    })
  })
})
