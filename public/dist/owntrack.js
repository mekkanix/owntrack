(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.OwnTrack = factory());
})(this, (function () { 'use strict';

    const checkForValidConfig = (config) => {
        try {
            // config
            if (!config)
                throw new Error('OwnTrack: A configuration object is required at first call.');
            // config.services
            if (!Array.isArray(config.services))
                throw new Error(`OwnTrack: 'services' must be an array.`);
            // config.services.service
            if (config.services) {
                for (const srv of config.services) {
                    if (!srv.name)
                        throw new Error(`OwnTrack: Service: 'name' is required.`);
                    if (srv.label && typeof srv.label !== 'string')
                        throw new Error(`OwnTrack: Service: 'label' must be a string.`);
                    if (srv.type && typeof srv.type !== 'string')
                        throw new Error(`OwnTrack: Service: 'type' must be a string.`);
                    if (srv.description && typeof srv.description !== 'string')
                        throw new Error(`OwnTrack: Service: 'description' must be a string.`);
                    if (!srv.trackingScriptUrl)
                        throw new Error(`OwnTrack: Service: 'trackingScriptUrl' is required.`);
                    if (typeof srv.trackingScriptUrl !== 'string')
                        throw new Error(`OwnTrack: Service: 'trackingScriptUrl' must be a string.`);
                    if (!srv.onInit || typeof srv.onInit !== 'function')
                        throw new Error(`OwnTrack: Service: 'onInit' callback is required.`);
                    if (!srv.handlers)
                        throw new Error(`OwnTrack: Service: 'handlers' is required.`);
                    if (typeof srv.handlers !== 'object')
                        throw new Error(`OwnTrack: Service: 'handlers' must be an object.`);
                }
            }
        }
        catch (err) {
            console.error(err.message);
            return false;
        }
        return true;
    };
    const checkForValidServiceName = (name, services) => {
        try {
            if (!services.includes(name))
                throw new Error(`OwnTrack: '${name}' service is not registered.`);
        }
        catch (err) {
            console.error(err.message);
            return false;
        }
        return true;
    };

    const setItem = (name, value) => {
        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
            value = JSON.stringify(value);
        }
        localStorage.setItem(name, value);
    };
    const getItem = (name) => {
        const value = localStorage.getItem(name);
        if (!value)
            return null;
        if (['true', 'false'].includes(value))
            return value === 'true';
        if (!isNaN(Number(value)))
            return Number(value);
        try {
            return JSON.parse(value);
        }
        catch (e) {
            /* Nothing to do; continue */
        }
        return String(value);
    };
    const removeItem = (name) => {
        localStorage.removeItem(name);
    };
    var ls = {
        setItem,
        getItem,
        removeItem,
    };

    class TrackingServiceWrapper {
        constructor(name, label, onInit) {
            this.name = name;
            this._l = label;
            this._onInit = onInit;
        }
        get label() {
            return this._l || this.name;
        }
    }

    const LS_ITEM_NAME = 'owntrack_uc';
    class TrackingGuard {
        constructor() {
            this._services = [];
            this._consents = [];
            this._actionsQueue = [];
            // rc: required cookies
            this._rcService = {
                isEditable: false,
                name: '_rc',
                description: 'This website uses some cookies needed for it to work. They cannot be disabled.',
                consent: { value: true, reviewed: true },
                tsw: new TrackingServiceWrapper('_rc', 'Required cookies', () => { })
            };
            this._consents = ls.getItem(LS_ITEM_NAME) || [];
        }
        wrapService({ name, label, type, description, trackingScriptUrl, onInit, handlers, }) {
            const srv = new TrackingServiceWrapper(name, label, onInit);
            for (const [fnName, fn] of Object.entries(handlers))
                srv[fnName] = this._setFnGuard(name, fn);
            this._services.push(srv);
            return {
                isEditable: true,
                name,
                type,
                description,
                consent: { value: this.hasConsent(name), reviewed: this.isReviewed(name) },
                tsw: srv,
            };
        }
        _setFnGuard(srv, handler) {
            return () => {
                if (this.hasConsent(srv))
                    return handler();
                else if (!this.isReviewed(srv))
                    this._actionsQueue.push({ srv, handler, processed: false });
            };
        }
        _processActionsQueue() {
            this._actionsQueue = this._actionsQueue.filter(action => {
                if (!this.isReviewed(action.srv))
                    return true;
                if (this.hasConsent(action.srv))
                    action.handler();
                return false;
            });
        }
        store() {
            const consents = this._services.map((srv) => ({
                srv: srv.name,
                v: this._consents.some((c) => c.srv === srv.name)
                    ? this._consents.filter((c) => c.srv === srv.name)[0].v
                    : false,
                r: this._consents.some((c) => c.srv === srv.name)
                    ? this._consents.filter((c) => c.srv === srv.name)[0].r
                    : false,
            }));
            this._consents = consents;
            ls.setItem(LS_ITEM_NAME, consents);
        }
        setConsent(value, service = '') {
            if (!service)
                for (const consent of this._consents) {
                    consent.v = value;
                    consent.r = true;
                }
            else
                this._consents = this._consents.map((consent) => {
                    if (consent.srv === service) {
                        consent.v = value;
                        consent.r = true;
                    }
                    return consent;
                });
            this.store();
            this._processActionsQueue();
        }
        setUnreviewedConsents(value) {
            this._consents = this._consents.map((consent) => {
                if (!consent.r)
                    consent.v = value;
                consent.r = true;
                return consent;
            });
            this.store();
            this._processActionsQueue();
        }
        getRCService() {
            return this._rcService;
        }
        getTrackingServices() {
            return this._services.map((srv) => ({
                isEditable: true,
                name: srv.name,
                consent: {
                    value: this._consents.some((c) => c.srv === srv.name)
                        ? this._consents.filter((c) => c.srv === srv.name)[0].v
                        : false,
                    reviewed: this._consents.some((c) => c.srv === srv.name)
                        ? this._consents.filter((c) => c.srv === srv.name)[0].r
                        : false,
                },
                tsw: srv,
            }));
        }
        isReviewed(service = '') {
            if (!service)
                return this._consents.every((consent) => consent.r);
            return !!this._consents.filter((consent) => consent.srv === service && consent.r).length;
        }
        hasConsent(service = '') {
            if (!service)
                return this._consents.every((consent) => consent.v);
            return !!this._consents.filter((consent) => consent.srv === service && consent.v).length;
        }
        hasGlobalConsent(value) {
            return this._consents.every((c) => c.v === value);
        }
    }

    const NS = 'http://www.w3.org/2000/svg';
    const getIconCloseElement = () => {
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('version', '1.1');
        svg.setAttribute('viewBox', '0 0 24 24');
        const l1 = document.createElementNS(NS, 'line');
        l1.setAttribute('x1', '1');
        l1.setAttribute('y1', '23');
        l1.setAttribute('x2', '23');
        l1.setAttribute('y2', '1');
        const l2 = document.createElementNS(NS, 'line');
        l2.setAttribute('x1', '1');
        l2.setAttribute('y1', '1');
        l2.setAttribute('x2', '23');
        l2.setAttribute('y2', '23');
        l1.setAttribute('stroke-width', '3');
        l2.setAttribute('stroke-width', '3');
        l1.setAttribute('stroke', '#000000');
        l2.setAttribute('stroke', '#000000');
        svg.append(l1);
        svg.append(l2);
        svg.classList.add('ot-icn');
        return svg;
    };
    const createElmt = (tag, classes = [], attrs = {}) => {
        const element = document.createElement(tag);
        for (const c of classes)
            element.classList.add(c);
        for (const [attr, val] of Object.entries(attrs))
            element.setAttribute(attr, val);
        return element;
    };
    const generateIconElement = (icon) => {
        return {
            close: getIconCloseElement(),
        }[icon];
    };

    const findElementChildByAttr = (el, attr, attrVal = '') => {
        let found = null;
        for (let i = 0; i < el.children.length; i++) {
            const child = el.children[i];
            const hasAttr = child.hasAttribute(attr);
            const childAttrVal = child.getAttribute(attr);
            if (hasAttr && (!attrVal || (attrVal && childAttrVal === attrVal)))
                found = child;
            else if (!found)
                found = findElementChildByAttr(child, attr, attrVal);
        }
        return found;
    };
    const findElementChildByClass = (el, _class) => {
        let found = null;
        for (let i = 0; i < el.children.length; i++) {
            const child = el.children[i];
            if (child.classList.contains(_class))
                found = child;
            else if (!found)
                found = findElementChildByClass(child, _class);
        }
        return found;
    };

    class UIProxy {
        constructor(trackingGuard) {
            this._services = [];
            // _d: DOM
            // _d.r: root
            // _d.r: entry root
            // _d.sr: settings root
            // _d.srvr: services root
            this._d = {
                r: createElmt('div'),
                er: createElmt('div'),
                sr: createElmt('div'),
                srvr: createElmt('div'),
            };
            this._settingsDisplayed = true;
            this._trackingGuard = trackingGuard;
            this._initBase();
            this._initEntry();
            this._initSettings();
            this._initServices();
        }
        _initBase() {
            this._d.r = document.createElement('div');
            this._d.r.classList.add('ot-root');
        }
        _initEntry() {
            this._d.er = createElmt('div', ['ot-entry-wrapper']);
            const elEntry = createElmt('div', ['ot-entry']);
            const elEntryNotice = createElmt('div', ['ot-entry__notice']);
            elEntryNotice.innerHTML =
                '<p>This website uses cookies &amp; analytics for tracking and/or advertising purposes. You can choose to accept them or not.</p>';
            elEntry.append(elEntryNotice);
            const btns = [
                {
                    t: 'Settings',
                    c: ['otua-settings', 'ot-btn', 'ot-ghost'],
                    a: { 'data-ot-entry-ua': 'settings' },
                    h: this._onSettingsOpenClick.bind(this),
                },
                {
                    t: 'Deny',
                    c: ['otua-deny', 'ot-btn'],
                    a: { 'data-ot-entry-ua': 'deny' },
                    h: this._onDenyAllServicesClick.bind(this),
                },
                {
                    t: 'Allow',
                    c: ['otua-allow', 'ot-btn'],
                    a: { 'data-ot-entry-ua': 'allow' },
                    h: this._onAllowAllServicesClick.bind(this),
                },
                {
                    i: 'close',
                    c: ['otua-close', 'ot-btn', 'ot-btn-icn', 'ot-ghost', 'ot-rounded'],
                    a: { 'data-ot-entry-ua': 'close' },
                    h: this._onMainCloseClick.bind(this),
                },
            ];
            const elEntryBtns = createElmt('div', ['ot-entry__btns']);
            for (const btn of btns) {
                let elEntryBtn;
                if (btn.t) {
                    elEntryBtn = createElmt('button', btn.c, btn.a);
                    elEntryBtn.innerHTML = btn.t;
                }
                else if (btn.i) {
                    elEntryBtn = createElmt('div', btn.c, btn.a);
                    elEntryBtn.append(generateIconElement('close'));
                }
                elEntryBtn.addEventListener('click', btn.h);
                elEntryBtns.append(elEntryBtn);
            }
            elEntry.append(elEntryBtns);
            this._d.er.append(elEntry);
            this._d.r.append(this._d.er);
        }
        _initSettings() {
            this._d.sr.classList.add('ot-settings-overlay');
            const elSettings = createElmt('div', ['ot-settings']);
            // "close" btn
            const elCloseBtn = createElmt('div', [
                'ot-settings__close',
                'ot-btn',
                'ot-btn-icn',
                'ot-ghost',
                'ot-rounded',
            ]);
            elCloseBtn.addEventListener('click', this._onSettingsCloseClick.bind(this));
            const elClose = generateIconElement('close');
            elCloseBtn.append(elClose);
            elSettings.append(elCloseBtn);
            this._d.sr.append(elSettings);
            // content
            let content;
            for (let i = 0; i < this._d.sr.children.length; i++)
                if (this._d.sr.children.item(Number(i)).classList.contains('ot-settings'))
                    content = this._d.sr.children.item(Number(i));
            const elHeadline = createElmt('h1');
            elHeadline.innerHTML = 'Tracking Settings';
            const elNotice = createElmt('p', ['ot-settings__notice']);
            elNotice.innerHTML =
                'Here you can manage tracking/analytics acceptance for each service.<br/> You can also accept or deny tracking for all services at once.';
            const elGActions = createElmt('div', ['ot-settings__main-actions']);
            const btns = [
                {
                    t: 'Deny all',
                    c: ['otua-deny', 'ot-btn', 'otua-deny'],
                    a: { 'data-ot-settings-ua': 'deny' },
                    h: this._onDenyAllServicesClick.bind(this),
                },
                {
                    t: 'Allow all',
                    c: ['otua-allow', 'ot-btn', 'otua-allow'],
                    a: { 'data-ot-settings-ua': 'allow' },
                    h: this._onAllowAllServicesClick.bind(this),
                },
            ];
            const elGActionsBtns = createElmt('div', [
                'ot-settings__main-actions__btns',
            ]);
            for (const btn of btns) {
                const elEntryBtn = createElmt('button', btn.c, btn.a);
                elEntryBtn.innerHTML = btn.t;
                elEntryBtn.addEventListener('click', btn.h);
                elGActionsBtns.append(elEntryBtn);
            }
            elGActions.append(elGActionsBtns);
            content.append(elHeadline);
            content.append(elNotice);
            content.append(elGActions);
        }
        _initServices() {
            this._d.srvr.classList.add('ot-settings__services');
        }
        _render() {
            // entry + settings
            const elBtnESettings = findElementChildByAttr(this._d.r, 'data-ot-entry-ua', 'settings');
            if (elBtnESettings) {
                if (this._settingsDisplayed)
                    elBtnESettings.classList.add('ot-active');
                else
                    elBtnESettings.classList.remove('ot-active');
            }
            const elBtnEDenyAll = findElementChildByAttr(this._d.r, 'data-ot-entry-ua', 'deny');
            const elBtnEAllowAll = findElementChildByAttr(this._d.r, 'data-ot-entry-ua', 'allow');
            const elBtnSDenyAll = findElementChildByAttr(this._d.sr, 'data-ot-settings-ua', 'deny');
            const elBtnSAllowAll = findElementChildByAttr(this._d.sr, 'data-ot-settings-ua', 'allow');
            if (elBtnEDenyAll)
                elBtnEDenyAll.classList.remove('ot-active');
            if (elBtnEAllowAll)
                elBtnEAllowAll.classList.remove('ot-active');
            if (elBtnSDenyAll)
                elBtnSDenyAll.classList.remove('ot-active');
            if (elBtnSAllowAll)
                elBtnSAllowAll.classList.remove('ot-active');
            if (this._trackingGuard.isReviewed()) {
                if (this._trackingGuard.hasGlobalConsent(false)) {
                    elBtnEDenyAll.classList.add('ot-active');
                    elBtnSDenyAll.classList.add('ot-active');
                }
                else if (this._trackingGuard.hasGlobalConsent(true)) {
                    elBtnEAllowAll.classList.add('ot-active');
                    elBtnSAllowAll.classList.add('ot-active');
                }
            }
            // settings:services
            for (const srv of this._services) {
                const elSrv = findElementChildByAttr(this._d.srvr, 'data-ot-srv', srv.name);
                if (elSrv) {
                    const elState = findElementChildByAttr(elSrv, 'data-ot-srv-state');
                    if (elState)
                        elState.innerHTML = this._getServiceStateLabel(srv);
                    const elBtnDeny = findElementChildByAttr(elSrv, 'data-ot-settings-srv-ua', 'deny');
                    const elBtnAllow = findElementChildByAttr(elSrv, 'data-ot-settings-srv-ua', 'allow');
                    if (elBtnDeny) {
                        elBtnDeny.classList.remove('ot-active');
                        if (srv.consent.reviewed && !srv.consent.value)
                            elBtnDeny.classList.add('ot-active');
                    }
                    if (elBtnAllow) {
                        elBtnAllow.classList.remove('ot-active');
                        if (srv.consent.reviewed && srv.consent.value)
                            elBtnAllow.classList.add('ot-active');
                    }
                }
            }
        }
        _onMainCloseClick() {
            this._trackingGuard.setUnreviewedConsents(false);
            this._services = this._trackingGuard.getTrackingServices();
            this._render();
            if (findElementChildByClass(this._d.r, 'ot-settings-overlay'))
                this._d.sr.remove();
            if (findElementChildByClass(this._d.r, 'ot-entry-wrapper'))
                this._d.er.remove();
        }
        _onSettingsOpenClick() {
            this._settingsDisplayed = true;
            if (!findElementChildByClass(this._d.r, 'ot-settings-overlay'))
                this._d.r.append(this._d.sr);
            this._render();
        }
        _onSettingsCloseClick() {
            this._settingsDisplayed = false;
            if (findElementChildByClass(this._d.r, 'ot-settings-overlay'))
                this._d.sr.remove();
            if (this._trackingGuard.isReviewed() &&
                findElementChildByClass(this._d.r, 'ot-entry-wrapper'))
                this._d.er.remove();
            this._render();
        }
        _onAllowAllServicesClick() {
            this._trackingGuard.setConsent(true);
            this._services = this._trackingGuard.getTrackingServices();
            this._render();
        }
        _onDenyAllServicesClick() {
            this._trackingGuard.setConsent(false);
            this._services = this._trackingGuard.getTrackingServices();
            this._render();
        }
        _onAllowServiceClick(service) {
            this._trackingGuard.setConsent(true, service);
            this._services = this._trackingGuard.getTrackingServices();
            this._render();
        }
        _onDenyServiceClick(service) {
            this._trackingGuard.setConsent(false, service);
            this._services = this._trackingGuard.getTrackingServices();
            this._render();
        }
        _getServiceStateLabel(srv) {
            if (!srv.consent.reviewed)
                return 'Pending';
            if (srv.consent.value)
                return 'Allowed';
            return 'Denied';
        }
        mount() {
            this._render();
            let settings;
            for (let i = 0; i < this._d.sr.children.length; i++)
                if (this._d.sr.children.item(Number(i)).classList.contains('ot-settings'))
                    settings = this._d.sr.children.item(Number(i));
            settings.append(this._d.srvr);
            if (this._settingsDisplayed)
                this._d.r.append(this._d.sr);
            document.body.append(this._d.r);
        }
        initSettingsServices(services) {
            this._services = services;
            for (const service of services) {
                const elSrv = createElmt('div', ['ot-settings__service'], {
                    'data-ot-srv': service.name,
                });
                const elSrvHeader = createElmt('div', ['ot-settings__service-header']);
                const elSrvName = createElmt('p', ['ot-settings__service-name']);
                const elSrvContent = createElmt('div', ['ot-settings__service-content']);
                const elSrvInfo = createElmt('div', ['ot-settings__service-info']);
                let elSrvType;
                if (service.type) {
                    elSrvType = createElmt('p', ['ot-settings__service-type']);
                    elSrvType.innerHTML = service.type;
                }
                elSrvName.innerHTML = service.tsw.label;
                elSrvHeader.append(elSrvName);
                if (elSrvType)
                    elSrvHeader.append(elSrvType);
                let elSrvDesc;
                if (service.description) {
                    elSrvDesc = createElmt('div', ['ot-settings__service-desc']);
                    elSrvDesc.innerHTML = service.description;
                }
                let elSrvState;
                if (service.isEditable)
                    elSrvState = createElmt('div', ['ot-settings__service-state'], {
                        'data-ot-srv-state': '',
                    });
                if (elSrvDesc)
                    elSrvInfo.append(elSrvDesc);
                if (elSrvState)
                    elSrvInfo.append(elSrvState);
                let elSrvBtns;
                if (service.isEditable) {
                    elSrvBtns = createElmt('div', ['ot-settings__service-btns']);
                    const btns = [
                        {
                            t: 'Deny',
                            c: ['otua-deny', 'ot-btn', 'ot-btn-sm'],
                            a: { 'data-ot-settings-srv-ua': 'deny' },
                            h: this._onDenyServiceClick.bind(this),
                        },
                        {
                            t: 'Allow',
                            c: ['otua-allow', 'ot-btn', 'ot-btn-sm'],
                            a: { 'data-ot-settings-srv-ua': 'allow' },
                            h: this._onAllowServiceClick.bind(this),
                        },
                    ];
                    for (const btn of btns) {
                        const elServiceBtn = createElmt('button', btn.c, btn.a);
                        elServiceBtn.innerHTML = btn.t;
                        elServiceBtn.addEventListener('click', (e) => btn.h(service.name, e));
                        elSrvBtns.append(elServiceBtn);
                    }
                }
                elSrvContent.append(elSrvInfo);
                if (elSrvBtns)
                    elSrvContent.append(elSrvBtns);
                elSrv.append(elSrvHeader);
                elSrv.append(elSrvContent);
                this._d.srvr.append(elSrv);
            }
        }
    }

    class OwnTrack {
        constructor(config) {
            this._trackingGuard = new TrackingGuard();
            this._services = [];
            this._ui = new UIProxy(this._trackingGuard);
            for (const service of config.services)
                this._services.push(this._trackingGuard.wrapService(service));
            this._trackingGuard.store();
            this._ui.initSettingsServices([
                this._trackingGuard.getRCService(),
                ...this._services
            ]);
            window.addEventListener('DOMContentLoaded', this._onReady.bind(this));
        }
        _onReady() {
            this._ui.mount();
        }
        service(name) {
            if (checkForValidServiceName(name, this._services.map(s => s.name)))
                return this._services.filter(s => s.name === name)[0].tsw;
        }
    }

    var index = (config) => {
        if (!window._OT && checkForValidConfig(config))
            window._OT = new OwnTrack(config);
        return window._OT;
    };

    return index;

}));
