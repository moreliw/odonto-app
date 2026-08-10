import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, forwardRef } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms'

export type SearchableSelectItem = { id: string; label: string; sublabel?: string }

const DIACRITICS = new RegExp('[̀-ͯ]', 'g')

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(DIACRITICS, '')
}

/**
 * Substituto de <select> para listas que crescem (pacientes, dentistas...): permite buscar por
 * digitação em vez de rolar uma lista nativa longa. Implementa ControlValueAccessor para funcionar
 * como um <select> comum com [(ngModel)].
 */
@Component({
    selector: 'app-searchable-select',
    imports: [CommonModule, FormsModule],
    providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SearchableSelectComponent), multi: true }],
    host: { '[class.ssel-disabled]': 'disabled' },
    template: `
    <div class="ssel">
      <button
        type="button"
        class="ssel-trigger"
        (click)="toggle()"
        [disabled]="disabled"
        [attr.aria-expanded]="open"
        [attr.aria-label]="ariaLabel || placeholder"
        aria-haspopup="listbox"
      >
        <span class="ssel-value" [class.ssel-placeholder]="!selectedLabel">{{ selectedLabel || placeholder }}</span>
        <svg class="ssel-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      @if (open) {
        <div class="ssel-panel" role="listbox">
          <div class="ssel-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input
              #searchInput
              type="text"
              [(ngModel)]="query"
              (ngModelChange)="onQueryChange()"
              [placeholder]="searchPlaceholder"
              (keydown)="onKeydown($event)"
              autocomplete="off"
              aria-label="Buscar"
            />
          </div>
          <div class="ssel-options">
            @if (clearLabel !== null) {
              <button
                type="button"
                class="ssel-option"
                [class.active]="value === ''"
                [class.focused]="navIndex === 0"
                (click)="selectValue('')"
              >{{ clearLabel }}</button>
            }
            @for (item of filteredItems; track item.id; let i = $index) {
              <button
                type="button"
                class="ssel-option"
                [class.active]="value === item.id"
                [class.focused]="navIndex === i + (clearLabel !== null ? 1 : 0)"
                (click)="selectValue(item.id)"
              >
                <span>{{ item.label }}</span>
                @if (item.sublabel) { <small>{{ item.sublabel }}</small> }
              </button>
            }
            @if (filteredItems.length === 0 && !allowCreate) {
              <div class="ssel-empty">{{ emptyLabel }}</div>
            }
            @if (allowCreate) {
              <button
                type="button"
                class="ssel-option ssel-create"
                [class.focused]="navIndex === createIndex"
                (click)="requestCreate()"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>{{ query.trim() ? createLabel + ' "' + query.trim() + '"' : createLabel }}</span>
              </button>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class SearchableSelectComponent implements ControlValueAccessor {
  @Input() items: SearchableSelectItem[] = []
  @Input() placeholder = 'Selecionar...'
  @Input() searchPlaceholder = 'Buscar...'
  /** Rótulo da opção "nenhum selecionado" (ex.: "Todos os dentistas"). Null oculta essa opção. */
  @Input() clearLabel: string | null = null
  @Input() emptyLabel = 'Nenhum resultado encontrado'
  @Input() ariaLabel = ''
  /** Mostra uma linha de ação ao final da lista para criar um item novo (ex.: cadastrar paciente sem sair do formulário). */
  @Input() allowCreate = false
  @Input() createLabel = '+ Cadastrar novo'
  @Output() valueChange = new EventEmitter<string>()
  /** Emitido com o texto digitado na busca quando o usuário clica na opção de criar. */
  @Output() createRequested = new EventEmitter<string>()

  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>

  value = ''
  open = false
  query = ''
  navIndex = -1
  disabled = false

  private onChange: (v: string) => void = () => undefined
  private onTouched: () => void = () => undefined

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  get filteredItems() {
    const q = normalize(this.query.trim())
    if (!q) return this.items
    return this.items.filter(item => normalize(item.label).includes(q) || (item.sublabel && normalize(item.sublabel).includes(q)))
  }

  get selectedLabel() {
    if (!this.value) return this.clearLabel !== null ? this.clearLabel : null
    return this.items.find(item => item.id === this.value)?.label || null
  }

  writeValue(value: string | null): void {
    this.value = value || ''
  }
  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn
  }
  setDisabledState(disabled: boolean): void {
    this.disabled = disabled
  }

  toggle() {
    if (this.disabled) return
    if (this.open) this.close()
    else this.openPanel()
  }

  openPanel() {
    this.open = true
    this.query = ''
    this.navIndex = -1
    setTimeout(() => this.searchInputRef?.nativeElement.focus(), 0)
  }

  close() {
    if (!this.open) return
    this.open = false
    this.onTouched()
  }

  onQueryChange() {
    this.navIndex = -1
  }

  selectValue(id: string) {
    this.value = id
    this.onChange(id)
    this.valueChange.emit(id)
    this.close()
  }

  requestCreate() {
    this.createRequested.emit(this.query.trim())
    this.close()
  }

  /** Posição da linha "criar novo" na lista de navegação por teclado. */
  get createIndex() {
    return this.filteredItems.length + (this.clearLabel !== null ? 1 : 0)
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.open && !this.host.nativeElement.contains(event.target as Node)) this.close()
  }

  private get navOptions(): { id: string; isCreate?: boolean }[] {
    const clear = this.clearLabel !== null ? [{ id: '' }] : []
    const create = this.allowCreate ? [{ id: '__create__', isCreate: true }] : []
    return [...clear, ...this.filteredItems, ...create]
  }

  onKeydown(event: KeyboardEvent) {
    const options = this.navOptions
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      this.navIndex = Math.min(this.navIndex + 1, options.length - 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      this.navIndex = Math.max(this.navIndex - 1, 0)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const picked = options[this.navIndex]
      if (picked?.isCreate) this.requestCreate()
      else if (picked) this.selectValue(picked.id)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      this.close()
    }
  }
}
