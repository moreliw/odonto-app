import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'

@Component({
  selector: 'app-records',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="grid cols-2">
      <div class="card">
        <h2>Novo registro</h2>
        <form class="form" (ngSubmit)="createRecord()">
          <input class="input" [(ngModel)]="patientId" name="patientId" placeholder="ID do paciente" />
          <textarea class="textarea" [(ngModel)]="content" name="content" placeholder="Conteúdo do registro"></textarea>
          <button class="btn btn-primary" type="submit">Salvar</button>
        </form>
      </div>
      <div class="card">
        <h2>Upload de arquivo</h2>
        <div class="upload">
          <input type="file" (change)="onFile($event)" />
          <p class="muted mt-2">Formatos comuns: PDF, imagens. Tamanho até 20 MB.</p>
        </div>
      </div>
    </div>
  `
})
export class RecordsComponent {
  patientId = ''
  content = ''
  constructor(private http: HttpClient) {}

  createRecord() {
    const content = { text: this.content }
    this.http.post(`/api/records`, { patientId: this.patientId, content }).subscribe()
  }

  async onFile(event: any) {
    const file: File = event.target.files?.[0]
    if (!file) return
    const presign = await this.http.post<{ url: string; key: string }>(`/api/files/presign`, { contentType: file.type }).toPromise()
    if (!presign) return
    await fetch(presign.url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
    await this.http
      .post(`/api/files/finalize`, {
        key: presign.key,
        url: presign.url.split('?')[0],
        contentType: file.type,
        size: file.size,
        patientId: this.patientId || undefined
      })
      .toPromise()
    alert('Upload concluído')
  }
}
