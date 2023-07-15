import { generateIconElement } from './helpers/ui'

export default class UIManager {
  _isConsentReviewed = false
  _dom: { root: Element; settingsRoot: Element } = {
    root: document.createElement('div'),
    settingsRoot: document.createElement('div'),
  }
  _elRoot: Element

  constructor() {
    this._initBase()
    this._initEntry()
    this._initSettings()
    window.addEventListener('DOMContentLoaded', this._mount.bind(this))
  }

  _initBase() {
    this._dom.root = document.createElement('div')
    this._dom.root.classList.add('ot-root')
  }

  _initEntry() {
    const elEntryWrapper = document.createElement('div')
    elEntryWrapper.classList.add('ot-entry-wrapper')
    const elEntry = document.createElement('div')
    elEntry.classList.add('ot-entry')
    const elEntryNotice = document.createElement('div')
    elEntryNotice.classList.add('ot-entry__notice')
    elEntryNotice.innerHTML =
      '<p>This website uses cookies &amp; analytics for tracking and/or advertising purposes. You can choose to accept them or not.</p>'
    elEntry.append(elEntryNotice)
    const btns = [
      {
        t: 'Settings',
        c: ['settings', 'ot-btn', 'ot-ghost'],
        h: this._onOpenSettingsClick,
      },
      { t: 'Deny', c: ['deny', 'ot-btn', 'ot-error'], h: this._onDenyAllClick },
      {
        t: 'Allow',
        c: ['allow', 'ot-btn', 'ot-success'],
        h: this._onAllowAllClick,
      },
    ]
    const elEntryBtns = document.createElement('div')
    elEntryBtns.classList.add('ot-entry__btns')
    for (const btn of btns) {
      const elEntryBtn = document.createElement('button')
      btn.c.forEach((c) => elEntryBtn.classList.add(c))
      elEntryBtn.innerText = btn.t
      elEntryBtn.addEventListener('click', btn.h)
      elEntryBtns.append(elEntryBtn)
    }
    elEntry.append(elEntryBtns)
    elEntryWrapper.append(elEntry)
    this._dom.root.append(elEntryWrapper)
  }

  _initSettings() {
    this._dom.settingsRoot.classList.add('ot-settings-overlay')
    const elSettings = document.createElement('div')
    elSettings.classList.add('ot-settings')
    const elCloseBtn = document.createElement('div')
    elCloseBtn.classList.add('ot-settings__close')
    elCloseBtn.addEventListener('click', this._onCloseSettingsClick.bind(this))
    const elClose = generateIconElement('close')
    elClose.classList.add('ot-icn')
    elCloseBtn.append(elClose)
    elSettings.append(elCloseBtn)
    this._dom.settingsRoot.append(elSettings)
  }

  _onOpenSettingsClick() {
    console.log('open settings')
  }

  _onCloseSettingsClick() {
    console.log('close settings')
  }

  _onAllowAllClick() {
    console.log('allowed')
  }

  _onDenyAllClick() {
    console.log('denied')
  }

  _mount() {
    this._dom.root.append(this._dom.settingsRoot)
    document.body.append(this._dom.root)
  }

  setConsentReviewed(value: boolean): void {
    this._isConsentReviewed = value
  }
}
