import ServiceWrapper from './ServiceWrapper'

export type ConfigService = {
  name: string
  label?: string
  trackingScriptUrl: string
  onInit: Function
  handlers: object
}
export type Config = {
  services: ConfigService[]
}
export type OTService = {
  name: string
  consent: {
    value: boolean
    reviewed: boolean
  }
  sw: ServiceWrapper
}
export type TrackingServiceConsent = {
  srv: string
  v: boolean
  r: boolean
}
export type TrackingService = TrackingServiceConsent & {
  label: string
}
