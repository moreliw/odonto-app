import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'

@Injectable({ providedIn: 'root' })
export class UploadService {
  constructor(private http: HttpClient) {}

  async uploadFile(file: File, patientId?: string) {
    const presign = await this.http
      .post<{ url: string; key: string }>(`/api/files/presign`, { contentType: file.type })
      .toPromise()
    if (!presign) throw new Error('Presign failed')
    await fetch(presign.url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
    return await this.http
      .post(`/api/files/finalize`, {
        key: presign.key,
        url: presign.url.split('?')[0],
        contentType: file.type,
        size: file.size,
        patientId: patientId || undefined
      })
      .toPromise()
  }
}
