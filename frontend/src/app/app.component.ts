import { Component, OnInit, inject } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { ToastsComponent } from './components/toast/toast.component'
import { AnalyticsService } from './services/analytics.service'

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, ToastsComponent],
    template: `<router-outlet></router-outlet><app-toasts></app-toasts>`
})
export class AppComponent implements OnInit {
  private readonly analytics = inject(AnalyticsService)

  ngOnInit() {
    // Mede só o site comercial; o próprio serviço ignora /app e /admin.
    this.analytics.start()
  }
}
