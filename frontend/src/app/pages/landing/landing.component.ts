import { CommonModule, DOCUMENT } from '@angular/common'
import { Component, OnDestroy, OnInit, inject } from '@angular/core'
import { Meta, Title } from '@angular/platform-browser'
import { RouterLink } from '@angular/router'

type Benefit = {
  title: string
  description: string
}

type Testimonial = {
  name: string
  role: string
  quote: string
  avatar: string
}

type Faq = {
  question: string
  answer: string
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="lp-root">
      <header class="lp-nav" role="banner">
        <a class="lp-logo" routerLink="/" aria-label="Odonto SaaS">
          <span class="lp-logo-mark">O</span>
          <span>Odonto SaaS</span>
        </a>
        <nav class="lp-links" aria-label="Navegação principal">
          <a href="#beneficios">Benefícios</a>
          <a href="#demonstracao">Produto</a>
          <a href="#planos">Planos</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div class="lp-nav-cta">
          <a class="btn btn-ghost" routerLink="/login">Entrar</a>
          <a class="btn btn-primary" routerLink="/signup">Começar agora</a>
        </div>
      </header>

      <main>
        <section class="lp-hero" aria-labelledby="hero-title">
          <div class="lp-hero-copy">
            <span class="lp-tag">SaaS odontológico premium</span>
            <h1 id="hero-title">Gerencie sua clínica com precisão e escale sem limites</h1>
            <p>
              Um sistema completo para agenda, prontuário e financeiro com onboarding automático:
              o cliente assina, a clínica é ativada e o acesso é liberado em minutos.
            </p>
            <div class="lp-hero-actions">
              <a class="btn btn-primary" routerLink="/signup">Começar agora</a>
              <a class="btn btn-outline" href="#demonstracao">Ver demonstração</a>
            </div>
            <ul class="lp-trust-list" aria-label="Sinais de confiança">
              <li>Sem compromisso</li>
              <li>Ativação imediata</li>
              <li>Cancelamento fácil</li>
            </ul>
          </div>

          <figure class="lp-hero-visual" aria-label="Prévia do painel Odonto SaaS">
            <figcaption class="sr-only">Mockup do painel com agenda, indicadores e financeiro.</figcaption>
            <div class="lp-screen">
              <div class="lp-screen-top">
                <span></span><span></span><span></span>
              </div>
              <div class="lp-screen-body">
                <aside class="lp-screen-side">
                  <div class="lp-ui-line wide"></div>
                  <div class="lp-ui-line"></div>
                  <div class="lp-ui-line"></div>
                  <div class="lp-ui-line"></div>
                </aside>
                <section class="lp-screen-main">
                  <div class="lp-ui-kpis">
                    <article><strong>164</strong><span>Pacientes ativos</span></article>
                    <article><strong>42</strong><span>Consultas da semana</span></article>
                    <article><strong>R$ 57k</strong><span>Receita mensal</span></article>
                  </div>
                  <div class="lp-ui-grid">
                    <div class="lp-ui-card">
                      <h3>Agenda inteligente</h3>
                      <p>Próximos horários organizados por prioridade.</p>
                    </div>
                    <div class="lp-ui-card">
                      <h3>Financeiro</h3>
                      <p>Pagamentos, pendências e previsibilidade.</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </figure>
        </section>

        <section class="lp-problem-solution" aria-labelledby="problem-title">
          <article class="lp-problem">
            <h2 id="problem-title">Quando a operação trava, o crescimento para.</h2>
            <ul>
              <li>Agenda desorganizada gera faltas e perda de faturamento.</li>
              <li>Controle financeiro manual dificulta decisões rápidas.</li>
              <li>Ferramentas complexas aumentam retrabalho da equipe.</li>
            </ul>
          </article>
          <article class="lp-solution">
            <h2>Sua clínica em um fluxo unificado.</h2>
            <p>
              O Odonto SaaS conecta atendimento, prontuário e financeiro em uma experiência simples.
              Com automação desde o cadastro até a cobrança recorrente, você ganha tempo para focar em crescimento.
            </p>
          </article>
        </section>

        <section id="beneficios" class="lp-benefits" aria-labelledby="benefits-title">
          <header class="lp-section-head">
            <h2 id="benefits-title">Benefícios reais para operação e escala</h2>
            <p>Mais produtividade para sua equipe e mais previsibilidade para o negócio.</p>
          </header>
          <div class="lp-benefit-grid">
            @for (item of benefits; track item.title) {
              <article class="lp-benefit-card">
                <div class="lp-benefit-icon" aria-hidden="true"></div>
                <h3>{{ item.title }}</h3>
                <p>{{ item.description }}</p>
              </article>
            }
          </div>
        </section>

        <section id="demonstracao" class="lp-demo" aria-labelledby="demo-title">
          <header class="lp-section-head">
            <h2 id="demo-title">Demonstração do produto</h2>
            <p>Visão clara da rotina clínica com agenda, prontuário e financeiro no mesmo painel.</p>
          </header>
          <div class="lp-demo-grid">
            <article>
              <h3>Agenda inteligente</h3>
              <p>Organize consultas, encaixes e confirmações com menos fricção para recepção e dentistas.</p>
            </article>
            <article>
              <h3>Prontuário estruturado</h3>
              <p>Histórico clínico centralizado, fácil de consultar e pronto para suporte à decisão.</p>
            </article>
            <article>
              <h3>Financeiro previsível</h3>
              <p>Tenha receita, pendências e indicadores em uma visão executiva para agir rápido.</p>
            </article>
          </div>
        </section>

        <section class="lp-social-proof" aria-labelledby="social-title">
          <header class="lp-section-head">
            <h2 id="social-title">Quem usa sente o impacto no dia a dia</h2>
            <p>Depoimentos de perfis de clínicas que buscavam operação mais leve e crescimento sustentável.</p>
          </header>
          <div class="lp-testimonial-grid">
            @for (t of testimonials; track t.name) {
              <article class="lp-testimonial-card">
                <p>“{{ t.quote }}”</p>
                <div class="lp-testimonial-author">
                  <img [src]="t.avatar" [alt]="'Foto de ' + t.name" loading="lazy" width="48" height="48" />
                  <div>
                    <strong>{{ t.name }}</strong>
                    <span>{{ t.role }}</span>
                  </div>
                </div>
              </article>
            }
          </div>
        </section>

        <section id="planos" class="lp-pricing" aria-labelledby="pricing-title">
          <header class="lp-section-head">
            <h2 id="pricing-title">Planos transparentes para cada fase da clínica</h2>
            <p>Sem taxas escondidas. Atualize ou cancele quando quiser.</p>
          </header>
          <div class="lp-pricing-grid">
            <article class="lp-price-card">
              <h3>Basic</h3>
              <p class="lp-plan-note">Ideal para clínicas em crescimento</p>
              <strong>R$ 129 <span>/mês</span></strong>
              <ul>
                <li>Agenda completa de consultas</li>
                <li>Prontuário digital organizado</li>
                <li>Controle financeiro essencial</li>
              </ul>
              <a class="btn btn-outline btn-block" routerLink="/signup">Começar no Basic</a>
            </article>
            <article class="lp-price-card recommended">
              <span class="lp-badge">Recomendado</span>
              <h3>Pro</h3>
              <p class="lp-plan-note">Para clínicas com equipe e maior volume</p>
              <strong>R$ 279 <span>/mês</span></strong>
              <ul>
                <li>Tudo do plano Basic</li>
                <li>Relatórios operacionais avançados</li>
                <li>Escala com mais previsibilidade</li>
              </ul>
              <a class="btn btn-primary btn-block" routerLink="/signup">Escolher plano Pro</a>
            </article>
          </div>
          <p class="lp-pricing-guarantee">Garantia de 7 dias para validar o fluxo da sua operação.</p>
        </section>

        <section id="faq" class="lp-faq" aria-labelledby="faq-title">
          <header class="lp-section-head">
            <h2 id="faq-title">Perguntas frequentes</h2>
            <p>Tudo o que você precisa para decidir com segurança.</p>
          </header>
          <div class="lp-faq-list">
            @for (item of faqs; track item.question) {
              <details>
                <summary>{{ item.question }}</summary>
                <p>{{ item.answer }}</p>
              </details>
            }
          </div>
        </section>

        <section class="lp-final-cta" aria-labelledby="final-cta-title">
          <h2 id="final-cta-title">Comece sua clínica digital hoje</h2>
          <p>Ative sua conta, organize sua operação e escale com previsibilidade.</p>
          <a class="btn btn-primary" routerLink="/signup">Começar agora</a>
        </section>
      </main>

      <footer class="lp-footer" role="contentinfo">
        <div class="lp-footer-brand">
          <span class="lp-logo-mark">O</span>
          <div>
            <strong>Odonto SaaS</strong>
            <p>Sistema para clínicas odontológicas com foco em escala e previsibilidade.</p>
          </div>
        </div>
        <nav class="lp-footer-links" aria-label="Links institucionais">
          <a href="#planos">Planos</a>
          <a href="#faq">FAQ</a>
          <a href="/assets/termos-de-uso.html" target="_blank" rel="noopener">Termos</a>
          <a href="/assets/politica-de-privacidade.html" target="_blank" rel="noopener">Privacidade</a>
          <a href="mailto:contato@odontoapp.com">Contato</a>
        </nav>
      </footer>
    </div>
  `
})
export class LandingComponent implements OnInit, OnDestroy {
  private readonly title = inject(Title)
  private readonly meta = inject(Meta)
  private readonly document = inject(DOCUMENT)
  private previousTitle = ''
  private previousDescription = ''

  benefits: Benefit[] = [
    {
      title: 'Cada clínica em um ambiente seguro e independente',
      description: 'Você atende com tranquilidade sabendo que os dados de cada operação estão isolados e protegidos.'
    },
    {
      title: 'Onboarding que acelera o primeiro valor',
      description: 'Cadastro, plano e ativação em poucos passos, sem depender de configuração manual do time técnico.'
    },
    {
      title: 'Equipe mais produtiva no atendimento diário',
      description: 'Menos tempo em tarefas repetitivas e mais foco em consultas, experiência do paciente e qualidade clínica.'
    },
    {
      title: 'Decisão guiada por indicadores claros',
      description: 'Tenha uma visão objetiva da saúde operacional e financeira para agir antes dos gargalos.'
    },
    {
      title: 'Cobrança recorrente integrada ao crescimento',
      description: 'A assinatura mensal é automatizada e a ativação ocorre sem fricção para quem compra seu serviço.'
    },
    {
      title: 'Escalabilidade sem retrabalho estrutural',
      description: 'A base foi desenhada para crescer com segurança, mantendo estabilidade e baixo acoplamento.'
    }
  ]

  testimonials: Testimonial[] = [
    {
      name: 'Dra. Camila Nogueira',
      role: 'Diretora clínica · Sorriso Prime',
      quote: 'Em poucas semanas reduzimos faltas na agenda e ganhamos ritmo no atendimento sem sobrecarregar a recepção.',
      avatar: 'assets/testimonial-camila.svg'
    },
    {
      name: 'Dr. Rafael Morais',
      role: 'Sócio fundador · Clínica Vértice',
      quote: 'O financeiro ficou previsível. Hoje decidimos com dados reais, não com sensação de caixa.',
      avatar: 'assets/testimonial-rafael.svg'
    },
    {
      name: 'Ana Luiza Prado',
      role: 'Gestora operacional · Odonto Flow',
      quote: 'A implantação foi direta e a equipe se adaptou rápido porque a interface é clara e sem complexidade desnecessária.',
      avatar: 'assets/testimonial-ana.svg'
    }
  ]

  faqs: Faq[] = [
    {
      question: 'Preciso de cartão para começar?',
      answer: 'Você pode iniciar o fluxo e só confirmar com cartão no momento de ativar a assinatura.'
    },
    {
      question: 'Posso cancelar quando quiser?',
      answer: 'Sim. O cancelamento é simples e você mantém clareza total sobre o status da assinatura.'
    },
    {
      question: 'Existe suporte para implantação?',
      answer: 'Sim. Você conta com suporte para onboarding e orientação nas primeiras etapas de uso.'
    },
    {
      question: 'Meus dados ficam seguros?',
      answer: 'Sim. Cada clínica opera em ambiente independente, com isolamento de dados e controle de acesso.'
    }
  ]

  ngOnInit() {
    this.previousTitle = this.title.getTitle()
    this.previousDescription = this.meta.getTag('name="description"')?.content || ''

    this.title.setTitle('Sistema para clínicas odontológicas | Gestão completa')
    this.meta.updateTag({
      name: 'description',
      content:
        'Sistema odontológico completo para agenda, prontuário e financeiro. Automatize sua clínica, melhore a gestão e cresça com previsibilidade.'
    })
    this.meta.updateTag({
      name: 'keywords',
      content: 'sistema odontológico, software para clínica, gestão de clínica odontológica'
    })
    this.ensureCanonical()
  }

  ngOnDestroy() {
    if (this.previousTitle) this.title.setTitle(this.previousTitle)
    if (this.previousDescription) {
      this.meta.updateTag({ name: 'description', content: this.previousDescription })
    }
  }

  private ensureCanonical() {
    const head = this.document.head
    if (!head) return
    let link: HTMLLinkElement | null = head.querySelector('link[rel="canonical"]')
    if (!link) {
      link = this.document.createElement('link')
      link.setAttribute('rel', 'canonical')
      head.appendChild(link)
    }
    link.setAttribute('href', this.document.location?.origin || '')
  }
}
