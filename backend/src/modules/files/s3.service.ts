import { Inject, Injectable, Scope } from '@nestjs/common'
import { REQUEST } from '@nestjs/core'
import type { Request } from 'express'
import { Client } from 'minio'
import { randomUUID } from 'crypto'
import { RequestContext } from '../tenancy/request-context'

@Injectable({ scope: Scope.REQUEST })
export class S3Service {
  private static sharedClient: Client | null = null
  private bucket: string = process.env.S3_BUCKET || 'odonto-files'

  constructor(@Inject(REQUEST) private readonly req: Request) {}

  private getMinioClient() {
    if (S3Service.sharedClient) return S3Service.sharedClient
    const end = process.env.S3_ENDPOINT || 'http://localhost:9000'
    const accessKey = process.env.S3_ACCESS_KEY || 'minioadmin'
    const secretKey = process.env.S3_SECRET_KEY || 'minioadmin'
    const url = new URL(end)
    const portStr = url.port || (url.protocol === 'https:' ? '443' : '9000')
    S3Service.sharedClient = new Client({
      endPoint: url.hostname,
      port: Number(portStr),
      useSSL: url.protocol === 'https:',
      accessKey,
      secretKey
    })
    return S3Service.sharedClient
  }

  async presignPut(contentType: string) {
    const ctx = this.req.tenantContext ?? RequestContext.get()
    if (!ctx) throw new Error('No tenant context')
    const key = `${ctx.slug}/${randomUUID()}`
    const client = this.getMinioClient()
    const exists = await client.bucketExists(this.bucket)
    if (!exists) await client.makeBucket(this.bucket)
    const url = await client.presignedPutObject(this.bucket, key, 60 * 10)
    return { url, key }
  }
}
