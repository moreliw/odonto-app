import 'reflect-metadata'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BillingService, PLAN_CATALOG } from '../src/modules/billing/billing.service'
import { AiClient } from '../src/modules/assistant/ai-client'
import { parseClinicDate, addMonths, weekStart } from '../src/modules/assistant/assistant-utils'
import { z } from 'zod'

const billing = new BillingService({} as any, {} as any, {} as any, {} as any)

describe('subscription safety', () => {
  it('never activates an unpaid plan-change checkout', async () => {
    assert.deepEqual(await (billing as any).onCheckoutSessionPaid({ id:'cs_test_fake',status:'complete',payment_status:'unpaid',metadata:{kind:'plan_change',tenantId:'other'} }), {tenantId:null,signupIntentId:null})
  })
  it('never activates an incomplete checkout even if payment_status is paid', async () => {
    assert.deepEqual(await (billing as any).onCheckoutSessionPaid({ id:'cs_test_fake',status:'open',payment_status:'paid' }), {tenantId:null,signupIntentId:null})
  })
  it('reuses an open checkout for the same plan instead of creating another subscription', async () => {
    const service:any = new BillingService({accessGrant:{findUnique:async()=>null},subscription:{findUnique:async()=>({pendingCheckoutSessionId:'cs_pending'})}} as any,{} as any,{} as any,{} as any)
    service.getStripeClient=()=>({checkout:{sessions:{retrieve:async()=>({status:'open',url:'https://checkout.stripe.com/test-only',metadata:{plan:'PRO'}})}}})
    assert.deepEqual(await service.changeTenantPlanLocked('tenant','PRO','test@example.invalid',1),{redirect:'https://checkout.stripe.com/test-only'})
  })
  it('waits for a completed but unpaid checkout without opening another payment', async () => {
    const service:any = new BillingService({accessGrant:{findUnique:async()=>null},subscription:{findUnique:async()=>({pendingCheckoutSessionId:'cs_pending'})}} as any,{} as any,{} as any,{} as any)
    service.getStripeClient=()=>({checkout:{sessions:{retrieve:async()=>({status:'complete',payment_status:'unpaid'})}}})
    assert.equal((await service.changeTenantPlanLocked('tenant','PRO','test@example.invalid',1)).ok,false)
  })
  it('does not replace a newer subscription with a delayed checkout event', async () => {
    const service:any = new BillingService({subscription:{findUnique:async()=>({providerSubscriptionId:'sub_new',pendingCheckoutSessionId:null})}} as any,{} as any,{} as any,{} as any)
    assert.deepEqual(await service.onPlanChangeCheckoutPaid({id:'cs_old',metadata:{tenantId:'tenant',plan:'BASIC'},subscription:'sub_old'}),{tenantId:'tenant',signupIntentId:null})
  })
  it('reconciles the current subscription on repeated checkout events instead of reverting its plan', async () => {
    const service:any = new BillingService({subscription:{findUnique:async()=>({providerSubscriptionId:'sub_current'})}} as any,{} as any,{} as any,{} as any)
    const current={id:'sub_current',status:'active'}
    service.retrieveStripeSubscription=async()=>current
    let reconciled=false
    service.onSubscriptionUpdated=async(value:any)=>{assert.equal(value,current);reconciled=true}
    await service.onPlanChangeCheckoutPaid({id:'cs_old',metadata:{tenantId:'tenant',plan:'BASIC'},subscription:'sub_current'})
    assert.equal(reconciled,true)
  })
  it('rejects a Stripe price whose amount, currency, or recurring interval differs from the offer', () => {
    const good = {id:'price_test',active:true,unit_amount:12900,currency:'brl',recurring:{interval:'month',interval_count:1,usage_type:'licensed'}}
    assert.doesNotThrow(() => (billing as any).assertPriceMatchesPlan(good,PLAN_CATALOG.BASIC,'MONTH'))
    for(const bad of [{...good,unit_amount:1290},{...good,currency:'usd'},{...good,active:false},{...good,recurring:{interval:'month',interval_count:3}},{...good,recurring:{interval:'year',interval_count:1}},{...good,recurring:{interval:'month',usage_type:'metered'}}]) {
      assert.throws(()=>(billing as any).assertPriceMatchesPlan(bad,PLAN_CATALOG.BASIC,'MONTH'),/preço/)
    }
  })
  it('reads the subscription end date from modern item-level Stripe responses', () => {
    const value=(billing as any).stripeSubscriptionPeriodEnd({items:{data:[{current_period_end:1800000000}]}})
    assert.equal(value.toISOString(),new Date(1800000000*1000).toISOString())
  })
  it('hides unavailable annual prices in live mode and exposes configured trial duration', () => {
    const oldKey=process.env.STRIPE_SECRET_KEY, oldTrial=process.env.STRIPE_TRIAL_DAYS
    process.env.STRIPE_SECRET_KEY='sk_live_unit_test_only'
    process.env.STRIPE_TRIAL_DAYS='7'
    const oldAnnual=process.env.STRIPE_PRICE_BASIC_YEARLY
    delete process.env.STRIPE_PRICE_BASIC_YEARLY
    const plan=billing.getPublicPlans().find(p=>p.code==='BASIC')!
    assert.equal(plan.annualAvailable,false)
    assert.equal(plan.trialDays,7)
    if(oldKey)process.env.STRIPE_SECRET_KEY=oldKey;else delete process.env.STRIPE_SECRET_KEY
    if(oldTrial)process.env.STRIPE_TRIAL_DAYS=oldTrial;else delete process.env.STRIPE_TRIAL_DAYS
    if(oldAnnual)process.env.STRIPE_PRICE_BASIC_YEARLY=oldAnnual
  })
})

describe('AI provider errors', () => {
  it('validates provider JSON instead of returning malformed output as a success', async () => {
    const oldKey=process.env.GROQ_API_KEY
    process.env.AI_PROVIDER='groq';process.env.GROQ_API_KEY='unit-test-key'
    const client=new AiClient()
    const fetchOriginal=globalThis.fetch
    globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:'{"invented":true}'}}]}),{status:200})
    try { await assert.rejects(()=>client.json('test',{},z.object({message:z.string()})),/resposta incompleta/) }
    finally { globalThis.fetch=fetchOriginal;if(oldKey)process.env.GROQ_API_KEY=oldKey;else delete process.env.GROQ_API_KEY }
  })
  it('handles free-tier quota exhaustion with an actionable error and no fallback provider', async () => {
    const oldKey=process.env.GROQ_API_KEY
    process.env.AI_PROVIDER='groq';process.env.GROQ_API_KEY='unit-test-key'
    const client=new AiClient(), original=globalThis.fetch
    let calls=0
    globalThis.fetch=async()=>{calls++;return new Response('{}',{status:429})}
    try { await assert.rejects(()=>client.json('test',{},z.object({message:z.string()})),/limite de uso/);assert.equal(calls,1) }
    finally { globalThis.fetch=original;if(oldKey)process.env.GROQ_API_KEY=oldKey;else delete process.env.GROQ_API_KEY }
  })
})

describe('clinic calendar',()=>{
  it('uses Monday in the clinic timezone even when UTC already changed day',()=>{
    assert.equal(weekStart(new Date('2026-11-09T01:00:00Z')).toISOString(),'2026-11-02T03:00:00.000Z')
    assert.equal(weekStart(new Date('2026-11-09T04:00:00Z')).toISOString(),'2026-11-09T03:00:00.000Z')
  })
  it('rejects impossible dates and clamps recall intervals to month end',()=>{
    assert.throws(()=>parseClinicDate('2026-02-30T10:00'))
    assert.equal(addMonths(new Date('2024-08-31T15:00:00Z'),6).toISOString(),'2025-02-28T15:00:00.000Z')
  })
})
