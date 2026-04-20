import { bootstrapApplication } from '@angular/platform-browser'
import { AppComponent } from './app/app.component'
import { appConfig } from './app/app.config'

if (typeof location !== 'undefined') {
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  const isIPv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(location.hostname)
  if (!isLocal && !isIPv4 && location.protocol === 'http:') {
    location.replace(`https://${location.host}${location.pathname}${location.search}${location.hash}`)
  }
}

bootstrapApplication(AppComponent, appConfig)
