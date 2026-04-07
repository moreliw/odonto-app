import { Injectable } from '@nestjs/common'
import { Client } from 'minio'
import { randomUUID } from 'crypto'
import { RequestContext } from '../tenancy/request-context'

@Injectable()
export class S3Service {
  private client: Client | null = null
  private bucket: string = process.env.S3_BUCKET || 'odonto-files'
  private getClient() {
    if (this.client) return this.client
    const end = process.env.S3_ENDPOINT || 'http://localhost:9000'
    const accessKey = process.env.S3_ACCESS_KEY || 'minioadmin'
    const secretKey = process.env.S3_SECRET_KEY || 'minioadmin'
    const url = new URL(end)
    this.client = new Client({ endPoint: url.hostname, port: Number(url.port || 9000), useSSL: url.protocol === 'https:', accessKey, secretKey })
    return this.client
  }
  async presignPut(contentType: string) {
    const ctx = RequestContext.get()
    if (!ctx) throw new Error('No tenant context')
    const key = `${ctx.slug}/${randomUUID()}`
    const client = this.getClient()
    const exists = await client.bucketExists(this.bucket)
    if (!exists) await client.makeBucket(this.bucket)
    const url = await client.presignedPutObject(this.bucket, key, 60 * 10)
    return { url, key }
  }
}
