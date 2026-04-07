import { bootstrapApplication } from '@angular/platform-browser'
import { AppComponent } from './app/app.component'
import { appConfig } from './app/app.config'

if (typeof location !== 'undefined') {
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  if (!isLocal && location.protocol === 'http:') {
    location.replace(`https://${location.host}${location.pathname}${location.search}${location.hash}`)
  }
}

bootstrapApplication(AppComponent, appConfig)
