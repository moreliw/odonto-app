import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { Queue, Worker, Job } from 'bullmq'
import IORedis from 'ioredis'

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private connection!: IORedis
  private emailQueue!: Queue
  private emailWorker!: Worker

  onModuleInit() {
    const url = process.env.REDIS_URL
    if (!url) {
      console.log('[jobs] disabled (no REDIS_URL)')
      return
    }
    this.connection = new IORedis(url, { maxRetriesPerRequest: null })
    this.emailQueue = new Queue('emails', { connection: this.connection })
    this.emailWorker = new Worker(
      'emails',
      async (job: Job) => {
        const { to, subject } = job.data
        console.log(`[job] send email to=${to} subject=${subject}`)
      },
      { connection: this.connection }
    )
  }

  async enqueueEmail(to: string, subject: string) {
    await this.emailQueue.add('send', { to, subject })
    return { queued: true }
  }

  async onModuleDestroy() {
    await this.emailWorker?.close()
    await this.emailQueue?.close()
    await this.connection?.quit()
  }
}
