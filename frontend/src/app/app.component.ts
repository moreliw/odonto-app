import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { ToastsComponent } from './components/toast/toast.component'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastsComponent],
  template: `<router-outlet></router-outlet><app-toasts></app-toasts>`
})
export class AppComponent {}
