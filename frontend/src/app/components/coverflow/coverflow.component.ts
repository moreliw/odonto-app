import { CommonModule } from '@angular/common'
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  QueryList,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  ViewChildren
} from '@angular/core'

export interface CoverflowSlide {
  id: string
  label: string
}

/**
 * Carrossel em perspectiva (estilo "coverflow") para exibir as telas do sistema.
 *
 * O laço é feito dobrando a distância de cada card para o caminho mais curto do anel —
 * não há nós clonados nem reordenação do DOM. O card é teleportado para o outro lado
 * exatamente a meia volta de distância, quando já está com opacidade zero.
 *
 * As transformações são escritas direto no DOM dentro do requestAnimationFrame: passar
 * 60 atualizações por segundo pelo change detection re-renderizaria todos os cards a cada
 * quadro por números que o Angular nunca precisa ver.
 */
@Component({
  selector: 'app-coverflow',
  imports: [CommonModule],
  template: `
    <div class="cf" role="region" aria-roledescription="carrossel" [attr.aria-label]="label">
      <div
        #frame
        class="cf-frame"
        tabindex="0"
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointercancel)="onPointerUp($event)"
        (keydown)="onKeydown($event)"
      >
        <div class="cf-stage">
          @for (slide of slides; track slide.id; let i = $index) {
            <div
              #card
              class="cf-card"
              role="group"
              aria-roledescription="slide"
              [attr.aria-label]="slide.label + ' — ' + (i + 1) + ' de ' + slides.length"
              [attr.aria-hidden]="i === selected ? null : 'true'"
            >
              <ng-container [ngTemplateOutlet]="slideTemplate" [ngTemplateOutletContext]="{ $implicit: slide.id }" />
            </div>
          }
        </div>
      </div>

      <div class="cf-nav">
        <button type="button" class="cf-arrow" aria-label="Tela anterior" (click)="nudge(-1)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div class="cf-dots" role="tablist" [attr.aria-label]="label">
          @for (slide of slides; track slide.id; let i = $index) {
            <button
              type="button"
              role="tab"
              class="cf-dot"
              [class.is-active]="i === selected"
              [attr.aria-selected]="i === selected"
              [attr.tabindex]="i === selected ? 0 : -1"
              [id]="'cf-tab-' + slide.id"
              [attr.aria-controls]="'cf-panel-' + slide.id"
              (click)="goTo(i)"
            >{{ slide.label }}</button>
          }
        </div>
        <button type="button" class="cf-arrow" aria-label="Próxima tela" (click)="nudge(1)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </div>
    </div>
  `
})
export class CoverflowComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) slides: CoverflowSlide[] = []
  @Input({ required: true }) slideTemplate!: TemplateRef<{ $implicit: string }>
  @Input() label = 'Telas do sistema'
  /** Índice controlado pelo pai — permite sincronizar o carrossel com outra navegação da página. */
  @Input() index = 0
  @Output() indexChange = new EventEmitter<number>()

  @ViewChild('frame') private frameRef?: ElementRef<HTMLElement>
  @ViewChildren('card') private cardRefs?: QueryList<ElementRef<HTMLElement>>

  selected = 0

  /** Grau de inclinação do primeiro vizinho. */
  private readonly rotate = 40
  /** Quanto o primeiro vizinho recua, como fração da largura do card. */
  private readonly depth = 0.55
  /** Expoente da distância: abaixo de 1 a inclinação suaviza conforme o card se afasta. */
  private readonly falloff = 0.56
  /** Opacidade perdida por passo a partir do centro. */
  private readonly fade = 0.22
  /** Espaço entre cards, como fração da largura. */
  private readonly gap = 0.06

  /** Índice fracionário no centro — a única fonte de verdade da posição. */
  private pos = 0
  /**
   * Para onde a acomodação atual está indo. Partir de `pos` engoliria uma seta pressionada
   * no meio do movimento, antes do arredondamento avançar.
   */
  private target = 0
  private cardWidth = 0
  private raf: number | null = null
  private resizeObserver?: ResizeObserver
  private drag: { id: number; x: number; pos: number; v: number; t: number } | null = null
  private reduceMotion = false

  private get count() {
    return this.slides.length
  }

  ngAfterViewInit() {
    this.reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    this.pos = this.index
    this.target = this.index
    this.selected = this.index

    // A largura do card determina o passo, a profundidade e a perspectiva — é a única
    // medida que importa, e só quando a caixa realmente muda.
    const frame = this.frameRef?.nativeElement
    if (frame && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.measure())
      this.resizeObserver.observe(frame)
    }
    this.measure()
    this.cardRefs?.changes.subscribe(() => this.measure())
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['index'] && !changes['index'].firstChange) {
      const next = changes['index'].currentValue as number
      if (next !== this.selected) this.goTo(next, false)
    }
  }

  ngOnDestroy() {
    if (this.raf !== null) cancelAnimationFrame(this.raf)
    this.resizeObserver?.disconnect()
  }

  private measure() {
    const card = this.cardRefs?.first?.nativeElement
    if (!card) return
    this.cardWidth = card.offsetWidth
    this.paint()
  }

  private paint() {
    if (!this.cardWidth || !this.count) return
    const pitch = this.cardWidth * (1 + this.gap)

    this.cardRefs?.forEach((ref, i) => {
      const card = ref.nativeElement

      // Dobra a distância para o caminho mais curto do anel — este é todo o mecanismo do laço.
      let offset = i - this.pos
      offset = ((offset % this.count) + this.count) % this.count
      if (offset > this.count / 2) offset -= this.count

      const distance = Math.abs(offset)
      // Inclinação e recuo suavizam conforme o card se afasta: dobrar a distância acrescenta
      // só cerca de metade a mais de cada um. Uma rampa linear fecharia o segundo card.
      const ramp = Math.pow(distance, this.falloff)
      // Limitada antes do perfil para que um card distante nunca vire de costas.
      const tilt = Math.min(this.rotate * ramp, 78) * Math.sign(offset)

      card.style.transform =
        `translateX(calc(-50% + ${offset * pitch}px)) ` +
        `translateZ(${-this.depth * this.cardWidth * ramp}px) rotateY(${-tilt}deg)`

      // O card salta para o outro lado exatamente a meia volta — precisa já estar invisível lá.
      const edge = Math.min(1, Math.max(0, this.count / 2 - distance))
      card.style.opacity = String(Math.max(0, 1 - this.fade * distance) * edge)
      card.style.zIndex = String(100 - Math.round(distance))
      card.style.pointerEvents = distance < 0.5 ? 'auto' : 'none'
    })
  }

  private wrapIndex(pos: number) {
    return ((Math.round(pos) % this.count) + this.count) % this.count
  }

  private settle(target: number, emit = true) {
    if (this.raf !== null) cancelAnimationFrame(this.raf)
    this.target = target

    const landed = this.wrapIndex(target)
    if (landed !== this.selected) {
      this.selected = landed
      if (emit) this.indexChange.emit(landed)
    }

    if (this.reduceMotion) {
      this.pos = target
      this.paint()
      return
    }

    const step = () => {
      const remaining = target - this.pos
      if (Math.abs(remaining) < 0.0004) {
        this.pos = target
        this.paint()
        this.raf = null
        return
      }
      // Amortecimento exponencial, sem oscilação — o card não deve passar do ponto e voltar.
      this.pos += remaining * 0.16
      this.paint()
      this.raf = requestAnimationFrame(step)
    }
    this.raf = requestAnimationFrame(step)
  }

  goTo(index: number, emit = true) {
    if (!this.count) return
    // Vai pelo caminho mais curto em vez de desenrolar o anel inteiro.
    const target = index + Math.round((this.target - index) / this.count) * this.count
    this.settle(target, emit)
  }

  nudge(by: number) {
    this.settle(Math.round(this.target) + by)
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      this.nudge(-1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      this.nudge(1)
    }
  }

  onPointerDown(event: PointerEvent) {
    if (!this.cardWidth) return
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf)
      this.raf = null
    }
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    this.target = this.pos
    this.drag = { id: event.pointerId, x: event.clientX, pos: this.pos, v: 0, t: performance.now() }
  }

  onPointerMove(event: PointerEvent) {
    const drag = this.drag
    if (!drag || drag.id !== event.pointerId) return
    const pitch = this.cardWidth * (1 + this.gap)
    if (!pitch) return

    const now = performance.now()
    const previous = this.pos
    this.pos = drag.pos - (event.clientX - drag.x) / pitch
    // Cards por segundo, usado para o arremesso.
    drag.v = ((this.pos - previous) / Math.max(now - drag.t, 1)) * 1000
    drag.t = now

    const landed = this.wrapIndex(this.pos)
    if (landed !== this.selected) {
      this.selected = landed
      this.indexChange.emit(landed)
    }
    this.paint()
  }

  onPointerUp(event: PointerEvent) {
    const drag = this.drag
    if (!drag || drag.id !== event.pointerId) return
    this.drag = null
    // Um movimento rápido carrega adiante, mas nunca mais que dois cards.
    const carried = Math.max(-2, Math.min(2, drag.v * 0.18))
    this.settle(Math.round(this.pos + carried))
  }
}
