import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { firstValueFrom } from 'rxjs'
import { PatientDetailsService } from './patient-details.service'
import { PatientRecord } from './patient-details.models'
import { OdontogramToothComponent } from '../../records/odontogram-tooth.component'
import { ToastService } from '../../../services/toast.service'

type DentalFinding = {
  id: string
  teeth: string[]
  status: string
  surfaces: string[]
  note: string
  treatmentStatus?: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'
  professionalId?: string
  professionalName?: string
  clinicalDate?: string
  value?: number | null
  recordedAt?: string
}

const CONDITIONS = [
  ['HEALTHY', 'Saudável'], ['CARIES', 'Cárie'], ['RESTORATION', 'Restauração'], ['ENDO', 'Tratamento endodôntico'],
  ['CROWN', 'Coroa'], ['IMPLANT', 'Implante'], ['MISSING', 'Ausente'], ['EXTRACTION', 'Extração indicada'],
  ['EXTRACTED', 'Extraído'], ['PROSTHESIS', 'Prótese'], ['PERIODONTITIS', 'Periodontite'], ['GINGIVITIS', 'Gengivite'],
  ['FRACTURE', 'Fratura'], ['IN_PROGRESS', 'Tratamento em andamento'], ['OTHER', 'Outro']
].map(([id, label]) => ({ id, label }))

@Component({
  selector: 'app-patient-dental-chart',
  standalone: true,
  imports: [CommonModule, FormsModule, OdontogramToothComponent],
  template: `
    <section class="dental-shell">
      <header class="dental-toolbar">
        <div><span>Numeração FDI</span><h2>Odontograma clínico</h2><p>Selecione um dente para consultar ou registrar sua evolução.</p></div>
        <div class="segmented" role="tablist" aria-label="Tipo de dentição">
          <button type="button" [class.active]="dentition === 'PERMANENT'" (click)="setDentition('PERMANENT')">Permanente</button>
          <button type="button" [class.active]="dentition === 'DECIDUOUS'" (click)="setDentition('DECIDUOUS')">Decídua</button>
        </div>
      </header>

      <div class="dental-layout">
        <div class="chart-panel">
          <div class="arch-label"><span>Direita do paciente</span><b>Arcada superior</b><span>Esquerda do paciente</span></div>
          <div class="tooth-row">
            @for (tooth of upperTeeth; track tooth) {
              <button type="button" class="tooth-button" [class.selected]="selectedTooth === tooth" (click)="selectTooth(tooth)" [attr.aria-label]="'Selecionar dente ' + tooth">
                <span>{{ tooth }}</span><app-odontogram-tooth [tooth]="tooth" [status]="toothStatus(tooth)" [selected]="selectedTooth === tooth" />
                @if (conditionCount(tooth) > 1) { <i>{{ conditionCount(tooth) }}</i> }
              </button>
            }
          </div>
          <div class="arch-divider"><span>Arcada superior</span><span>Arcada inferior</span></div>
          <div class="tooth-row lower">
            @for (tooth of lowerTeeth; track tooth) {
              <button type="button" class="tooth-button" [class.selected]="selectedTooth === tooth" (click)="selectTooth(tooth)" [attr.aria-label]="'Selecionar dente ' + tooth">
                <app-odontogram-tooth [tooth]="tooth" [status]="toothStatus(tooth)" [selected]="selectedTooth === tooth" /><span>{{ tooth }}</span>
                @if (conditionCount(tooth) > 1) { <i>{{ conditionCount(tooth) }}</i> }
              </button>
            }
          </div>
          <div class="legend" aria-label="Legenda do odontograma">
            @for (item of legendItems; track item.id) { <span><i [class]="'legend-' + item.id.toLowerCase()"></i>{{ item.label }}</span> }
          </div>
        </div>

        <aside class="tooth-panel">
          @if (!selectedTooth) {
            <div class="tooth-empty"><div aria-hidden="true">⌁</div><h3>Selecione um dente</h3><p>Veja condições, procedimentos e todo o histórico clínico daquele dente.</p></div>
          } @else {
            <header><div><span>Dente selecionado</span><h3>Dente {{ selectedTooth }}</h3></div><button type="button" class="btn btn-icon" (click)="selectedTooth=''" aria-label="Fechar detalhes">×</button></header>
            <div class="current-condition">
              <span>Situação atual</span>
              <strong><i [class]="'condition-dot status-' + toothStatus(selectedTooth).toLowerCase()"></i>{{ conditionLabel(toothStatus(selectedTooth)) }}</strong>
              @if (latestToothFinding; as finding) {
                <small>{{ statusLabel(finding.treatmentStatus) }} · {{ finding.clinicalDate || finding.recordedAt | date:'dd/MM/yyyy' }}</small>
              } @else { <small>Nenhum registro clínico</small> }
            </div>
            <button type="button" class="btn btn-primary btn-block" (click)="openRegistration()">＋ Registrar condição/procedimento</button>
            <section class="tooth-history">
              <div class="panel-title"><h4>Histórico do dente</h4><span>{{ toothHistory.length }}</span></div>
              @if (!toothHistory.length) {
                <p class="empty-copy">Ainda não há condições registradas para este dente.</p>
              } @else {
                <div class="history-list">
                  @for (finding of toothHistory; track finding.id) {
                    <article>
                      <i [class]="'history-marker status-' + finding.status.toLowerCase()"></i>
                      <div><strong>{{ conditionLabel(finding.status) }}</strong><span>{{ finding.professionalName || 'Profissional não informado' }}</span>@if (finding.note) { <p>{{ finding.note }}</p> }</div>
                      <time>{{ finding.clinicalDate || finding.recordedAt | date:'dd/MM/yyyy' }}</time>
                    </article>
                  }
                </div>
              }
            </section>
          }
        </aside>
      </div>

      <div class="dental-summary">
        @for (item of summary; track item.id) { <div><span><i [class]="'status-' + item.id.toLowerCase()"></i>{{ item.label }}</span><strong>{{ item.count }}</strong></div> }
      </div>
    </section>

    @if (showModal) {
      <div class="modal-backdrop dental-modal-backdrop" (click)="showModal=false">
        <div class="modal dental-modal" role="dialog" aria-modal="true" aria-labelledby="dental-modal-title" (click)="$event.stopPropagation()">
          <header class="modal-header"><div><span class="modal-kicker">Dente {{ selectedTooth }}</span><h3 id="dental-modal-title">Registrar condição ou procedimento</h3><p>O registro será adicionado ao histórico, sem apagar os anteriores.</p></div><button type="button" class="btn btn-icon" (click)="showModal=false" aria-label="Fechar">×</button></header>
          <form (ngSubmit)="saveFinding()">
            <div class="form-grid">
              <label>Dente<input class="input" [value]="selectedTooth" disabled></label>
              <label>Condição/procedimento *<select class="select" name="condition" [(ngModel)]="form.status">@for (condition of conditions; track condition.id) { <option [value]="condition.id">{{ condition.label }}</option> }</select></label>
              <label>Status<select class="select" name="treatmentStatus" [(ngModel)]="form.treatmentStatus"><option value="PLANNED">Planejado</option><option value="IN_PROGRESS">Em andamento</option><option value="COMPLETED">Concluído</option></select></label>
              <label>Profissional<select class="select" name="professionalId" [(ngModel)]="form.professionalId"><option value="">Não informado</option>@for (professional of professionals; track professional.id) { <option [value]="professional.id">{{ professional.name }}</option> }</select></label>
              <label>Data<input class="input" type="date" name="clinicalDate" [(ngModel)]="form.clinicalDate"></label>
              <label>Valor opcional<input class="input" type="number" min="0" step="0.01" name="value" [(ngModel)]="form.value" placeholder="R$ 0,00"></label>
            </div>
            <fieldset><legend>Superfícies (opcional)</legend><div class="surface-options">@for (surface of surfaces; track surface.id) { <button type="button" [class.active]="form.surfaces.includes(surface.id)" (click)="toggleSurface(surface.id)">{{ surface.label }}</button> }</div></fieldset>
            <label class="notes-field">Observações<textarea class="textarea" rows="4" name="note" [(ngModel)]="form.note" placeholder="Achados, conduta, materiais ou orientações..."></textarea></label>
            <footer class="modal-footer"><button type="button" class="btn btn-ghost" (click)="showModal=false">Cancelar</button><button class="btn btn-primary" type="submit" [disabled]="saving">@if (saving) { <span class="spinner"></span> } Salvar no histórico</button></footer>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display:block; }
    .dental-shell { display:grid; gap:16px; }
    .dental-toolbar { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
    .dental-toolbar span,.modal-kicker { color:var(--primary); font-size:10px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
    .dental-toolbar h2 { margin:3px 0 3px; font-size:18px; } .dental-toolbar p { margin:0; color:var(--muted); font-size:12px; }
    .segmented { display:flex; padding:3px; border-radius:9px; background:var(--bg); }
    .segmented button { padding:7px 12px; border:0; border-radius:7px; color:var(--muted); background:transparent; font-size:11px; font-weight:700; cursor:pointer; }
    .segmented button.active { color:var(--primary); background:var(--surface); box-shadow:0 1px 4px rgba(15,23,42,.1); }
    .dental-layout { display:grid; grid-template-columns:minmax(0,1fr) 300px; min-height:480px; border:1px solid var(--border); border-radius:14px; overflow:hidden; background:#fbfdff; }
    .chart-panel { min-width:0; padding:18px 20px; border-right:1px solid var(--border); overflow-x:auto; }
    .arch-label,.arch-divider { min-width:850px; display:flex; justify-content:space-between; align-items:center; color:var(--muted); font-size:9px; text-transform:uppercase; }
    .arch-label b { color:var(--text); font-size:10px; letter-spacing:.05em; }
    .tooth-row { min-width:850px; display:grid; grid-template-columns:repeat(16,minmax(42px,1fr)); align-items:end; gap:4px; margin:10px 0 2px; }
    .tooth-row.lower { align-items:start; margin-top:2px; }
    .tooth-button { position:relative; min-width:0; padding:5px 3px; border:1px solid transparent; border-radius:9px; color:var(--muted); background:transparent; font-size:9px; cursor:pointer; transition:.15s ease; }
    .tooth-button:hover { border-color:#cbdcf6; background:#f3f8ff; } .tooth-button.selected { border-color:var(--primary); background:var(--primary-50); box-shadow:0 0 0 1px var(--primary); }
    .tooth-button i { position:absolute; top:2px; right:2px; display:grid; place-items:center; width:14px; height:14px; border-radius:50%; color:#fff; background:var(--primary); font-size:8px; font-style:normal; }
    .tooth-button app-odontogram-tooth { margin:2px auto; }
    .arch-divider { padding:10px 0; border-top:1px dashed var(--border); }
    .legend { min-width:850px; display:flex; flex-wrap:wrap; gap:8px 18px; margin-top:15px; padding-top:13px; border-top:1px solid var(--border); color:var(--muted); font-size:9px; }
    .legend span { display:flex; align-items:center; gap:5px; } .legend i,.condition-dot,.dental-summary i { width:7px; height:7px; border-radius:50%; background:#94a3b8; }
    .legend-caries,.status-caries { background:#ef4444!important; }.legend-restoration,.status-restoration { background:#2563eb!important; }.legend-endo,.status-endo { background:#8b5cf6!important; }.legend-implant,.status-implant { background:#14b8a6!important; }.legend-missing,.status-missing,.status-extracted { background:#94a3b8!important; }.legend-in_progress,.status-in_progress { background:#f59e0b!important; }
    .tooth-panel { padding:18px; background:var(--surface); }
    .tooth-panel>header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:14px; border-bottom:1px solid var(--border); }.tooth-panel header span { color:var(--muted); font-size:10px; }.tooth-panel h3 { margin:3px 0 0; font-size:17px; }
    .tooth-empty { display:grid; place-items:center; align-content:center; height:100%; min-height:360px; text-align:center; }.tooth-empty div { display:grid; place-items:center; width:46px; height:46px; border-radius:14px; color:var(--primary); background:var(--primary-50); font-size:25px; }.tooth-empty h3 { margin:14px 0 5px; }.tooth-empty p { max-width:220px; margin:0; color:var(--muted); font-size:11px; line-height:1.5; }
    .current-condition { display:grid; gap:5px; margin:14px 0; padding:12px; border-radius:10px; background:var(--bg); }.current-condition>span { color:var(--muted); font-size:9px; text-transform:uppercase; }.current-condition strong { display:flex; align-items:center; gap:7px; font-size:13px; }.current-condition small { color:var(--muted); font-size:10px; }
    .tooth-history { margin-top:20px; }.panel-title { display:flex; justify-content:space-between; align-items:center; }.panel-title h4 { margin:0; font-size:12px; }.panel-title span { display:grid; place-items:center; min-width:22px; height:22px; border-radius:11px; color:var(--primary); background:var(--primary-50); font-size:10px; font-weight:800; }
    .history-list { display:grid; gap:0; margin-top:8px; }.history-list article { display:grid; grid-template-columns:8px minmax(0,1fr) auto; gap:8px; padding:11px 0; border-bottom:1px solid var(--border); }.history-marker { width:7px; height:7px; margin-top:4px; border-radius:50%; background:#94a3b8; }.history-list strong,.history-list span { display:block; }.history-list strong { font-size:11px; }.history-list span,.history-list time { color:var(--muted); font-size:9px; }.history-list p { margin:4px 0 0; color:var(--text-secondary); font-size:10px; line-height:1.4; }.empty-copy { color:var(--muted); font-size:10px; line-height:1.5; }
    .dental-summary { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); border:1px solid var(--border); border-radius:12px; background:var(--surface); }.dental-summary div { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:13px 16px; border-right:1px solid var(--border); }.dental-summary div:last-child { border:0; }.dental-summary span { display:flex; align-items:center; gap:7px; color:var(--muted); font-size:10px; }.dental-summary strong { font-size:15px; }
    .dental-modal { max-width:720px; }.form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }.form-grid label,.notes-field { display:grid; gap:6px; color:var(--text); font-size:11px; font-weight:700; }.dental-modal fieldset { margin:16px 0; padding:0; border:0; }.dental-modal legend { margin-bottom:8px; font-size:11px; font-weight:700; }.surface-options { display:flex; flex-wrap:wrap; gap:7px; }.surface-options button { padding:7px 10px; border:1px solid var(--border); border-radius:8px; color:var(--muted); background:var(--surface); font-size:10px; cursor:pointer; }.surface-options button.active { border-color:var(--primary); color:var(--primary); background:var(--primary-50); }
    @media (max-width:980px) { .dental-layout { grid-template-columns:1fr; }.chart-panel { border-right:0; border-bottom:1px solid var(--border); }.tooth-panel { min-height:260px; }.dental-summary { grid-template-columns:repeat(3,1fr); }.dental-summary div:nth-child(3) { border-right:0; } }
    @media (max-width:640px) { .dental-toolbar { display:grid; }.dental-layout { min-height:0; }.chart-panel { padding:14px 10px; }.tooth-panel { padding:15px; }.dental-summary { grid-template-columns:1fr 1fr; }.dental-summary div { border-bottom:1px solid var(--border); }.form-grid { grid-template-columns:1fr; } }
  `]
})
export class PatientDentalChartComponent implements OnChanges {
  @Input({ required: true }) patientId = ''
  @Input() records: PatientRecord[] = []
  @Input() professionals: Array<{ id: string; name: string }> = []
  @Output() recordSaved = new EventEmitter<PatientRecord>()

  dentition: 'PERMANENT' | 'DECIDUOUS' = 'PERMANENT'
  selectedTooth = ''
  showModal = false
  saving = false
  readonly conditions = CONDITIONS
  readonly surfaces = [{id:'V',label:'Vestibular'},{id:'L/P',label:'Lingual/palatina'},{id:'M',label:'Mesial'},{id:'D',label:'Distal'},{id:'O/I',label:'Oclusal/incisal'}]
  readonly permanentUpper = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28']
  readonly permanentLower = ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38']
  readonly deciduousUpper = ['55','54','53','52','51','61','62','63','64','65']
  readonly deciduousLower = ['85','84','83','82','81','71','72','73','74','75']
  readonly legendItems = CONDITIONS.filter(item => ['CARIES','RESTORATION','ENDO','IMPLANT','MISSING','IN_PROGRESS'].includes(item.id))
  readonly priority = ['EXTRACTION','CARIES','FRACTURE','ENDO','PERIODONTITIS','GINGIVITIS','MISSING','EXTRACTED','CROWN','IMPLANT','PROSTHESIS','RESTORATION','IN_PROGRESS','OTHER','HEALTHY']
  form = this.emptyForm()

  constructor(private readonly api: PatientDetailsService, private readonly toast: ToastService) {}
  ngOnChanges() { if (this.selectedTooth && !this.allTeeth.includes(this.selectedTooth)) this.selectedTooth = '' }
  get upperTeeth() { return this.dentition === 'PERMANENT' ? this.permanentUpper : this.deciduousUpper }
  get lowerTeeth() { return this.dentition === 'PERMANENT' ? this.permanentLower : this.deciduousLower }
  get allTeeth() { return [...this.upperTeeth, ...this.lowerTeeth] }
  get odontogramRecords() { return this.records.filter(item => item.content?.type === 'ODONTOGRAM') }
  get latestFindings(): DentalFinding[] {
    const content = this.odontogramRecords[0]?.content
    if (Array.isArray(content?.findings)) return content.findings
    return (content?.entries || []).map((entry: any, index: number) => ({ id:`legacy-${entry.tooth}-${index}`, teeth:[entry.tooth], status:entry.status, surfaces:entry.surfaces || [], note:entry.note || '' }))
  }
  get toothHistory() { return this.latestFindings.filter(item => item.teeth?.includes(this.selectedTooth)).sort((a,b) => +new Date(b.clinicalDate || b.recordedAt || 0) - +new Date(a.clinicalDate || a.recordedAt || 0)) }
  get latestToothFinding() { return this.toothHistory[0] || null }
  get summary() { return ['CARIES','RESTORATION','IMPLANT','MISSING','IN_PROGRESS'].map(id => ({ id, label:this.conditionLabel(id), count:this.allTeeth.filter(tooth => this.findingsFor(tooth).some(item => item.status === id)).length })) }
  selectTooth(tooth: string) { this.selectedTooth = tooth }
  setDentition(value: 'PERMANENT' | 'DECIDUOUS') { this.dentition = value; this.selectedTooth = '' }
  findingsFor(tooth: string) { return this.latestFindings.filter(item => item.teeth?.includes(tooth)) }
  conditionCount(tooth: string) { return this.findingsFor(tooth).length }
  toothStatus(tooth: string) { const statuses = this.findingsFor(tooth).map(item => item.status); return this.priority.find(item => statuses.includes(item)) || 'HEALTHY' }
  conditionLabel(id: string) { return CONDITIONS.find(item => item.id === id)?.label || id }
  statusLabel(value?: string) { return ({PLANNED:'Planejado',IN_PROGRESS:'Em andamento',COMPLETED:'Concluído'} as Record<string,string>)[value || ''] || 'Status não informado' }
  openRegistration() { this.form = this.emptyForm(); this.showModal = true }
  toggleSurface(id: string) { this.form.surfaces = this.form.surfaces.includes(id) ? this.form.surfaces.filter(item => item !== id) : [...this.form.surfaces,id] }
  async saveFinding() {
    if (!this.selectedTooth || this.saving) return
    this.saving = true
    try {
      const professional = this.professionals.find(item => item.id === this.form.professionalId)
      const finding: DentalFinding = { id:`finding-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, teeth:[this.selectedTooth], status:this.form.status, surfaces:[...this.form.surfaces], note:this.form.note.trim(), treatmentStatus:this.form.treatmentStatus as any, professionalId:professional?.id, professionalName:professional?.name, clinicalDate:this.form.clinicalDate, value:this.form.value === null || this.form.value === '' ? null : Number(this.form.value), recordedAt:new Date().toISOString() }
      const findings = [...this.latestFindings, finding]
      const created = await firstValueFrom(this.api.createRecord(this.patientId, { type:'ODONTOGRAM', title:'Odontograma clínico', dentition:this.dentition, findings, notes:this.odontogramRecords[0]?.content?.notes || '' }))
      this.recordSaved.emit(created)
      this.showModal = false
      this.toast.success(`Registro do dente ${this.selectedTooth} salvo`)
    } catch (error: any) { this.toast.error('Não foi possível salvar o registro odontológico', error?.error?.message) }
    finally { this.saving = false }
  }
  private emptyForm() { return { status:'CARIES', treatmentStatus:'PLANNED', professionalId:'', clinicalDate:new Date().toISOString().slice(0,10), value:'' as number | string | null, surfaces:[] as string[], note:'' } }
}
