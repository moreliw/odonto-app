import { AfterViewInit, Directive, ElementRef, Input, OnDestroy } from '@angular/core'

/**
 * Revela o elemento quando ele entra na viewport, adicionando a classe `is-revealed`.
 *
 * A animação em si vive no CSS (`.reveal` / `.reveal.is-revealed`), então quem só quiser
 * mudar o efeito não precisa tocar em TypeScript. Uma vez revelado, o observer é
 * desligado — o elemento não volta a esconder ao rolar de volta, que é o comportamento
 * que a maioria das pessoas espera de uma landing.
 *
 * Sem IntersectionObserver (ou com `prefers-reduced-motion`), o conteúdo aparece na hora:
 * o efeito é enfeite, nunca pré-requisito para ler a página.
 */
@Directive({
  selector: '[appReveal]',
  host: { class: 'reveal' }
})
export class RevealDirective implements AfterViewInit, OnDestroy {
  /** Atraso em ms, para escalonar itens vizinhos de uma mesma grade. */
  @Input('appReveal') delay: number | string = 0

  private observer?: IntersectionObserver

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  ngAfterViewInit() {
    const el = this.host.nativeElement
    const delay = Number(this.delay) || 0
    if (delay) el.style.setProperty('--reveal-delay', `${delay}ms`)

    const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-revealed')
      return
    }

    // Rede de segurança para o conteúdo que já nasce na tela: o IntersectionObserver não
    // entrega nada enquanto a aba está oculta (segundo plano, pré-renderização, rastreador),
    // e sem isso a primeira dobra ficaria em opacity 0. A medição síncrona não depende do
    // ciclo de renderização, então o topo da página sempre aparece.
    if (this.isInViewport(el)) {
      el.classList.add('is-revealed')
      return
    }

    this.observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          el.classList.add('is-revealed')
          this.observer?.disconnect()
        }
      },
      // Dispara um pouco antes da borda: o elemento já chega revelado em vez de animar
      // depois de o leitor estar olhando para ele.
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    )
    this.observer.observe(el)
  }

  ngOnDestroy() {
    this.observer?.disconnect()
  }

  private isInViewport(el: HTMLElement) {
    const rect = el.getBoundingClientRect()
    const height = window.innerHeight || document.documentElement.clientHeight
    return rect.top < height && rect.bottom > 0
  }
}
