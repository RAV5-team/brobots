import { describe, expect, it } from 'vitest'
import { getKcContextMock } from './mocks'
import { formAttributes, isSupportedLogin, isSupportedRegistration } from './pageSupport'

describe('pageSupport', () => {
  it('draws the realm login itself: password, no identity providers or passkeys', () => {
    expect(isSupportedLogin(getKcContextMock({ pageId: 'login.ftl' }))).toBe(true)
    expect(isSupportedLogin(getKcContextMock({ pageId: 'login.ftl', overrides: { enableWebAuthnConditionalUI: true } }))).toBe(false)
    expect(isSupportedLogin(getKcContextMock({ pageId: 'login.ftl', overrides: { realm: { password: false } } }))).toBe(false)
  })

  it('draws plain registration itself, not terms, reCAPTCHA or list fields', () => {
    expect(isSupportedRegistration(getKcContextMock({ pageId: 'register.ftl' }))).toBe(true)
    expect(isSupportedRegistration(getKcContextMock({ pageId: 'register.ftl', overrides: { recaptchaRequired: true } }))).toBe(false)
    const withSelect = getKcContextMock({
      pageId: 'register.ftl',
      overrides: { profile: { attributesByName: { department: { name: 'department', required: false, readOnly: false, validators: {}, annotations: { inputType: 'select' } } } } },
    })
    expect(isSupportedRegistration(withSelect)).toBe(false)
  })

  it('hides the username field when the email is the login', () => {
    const names = (emailAsUsername: boolean) =>
      formAttributes(getKcContextMock({ pageId: 'register.ftl', overrides: { realm: { registrationEmailAsUsername: emailAsUsername } } })).map((a) => a.name)
    expect(names(true)).not.toContain('username')
    expect(names(false)).toContain('username')
  })
})
