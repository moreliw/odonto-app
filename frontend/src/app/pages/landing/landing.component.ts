import { CommonModule } from '@angular/common'
import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal, DOCUMENT } from '@angular/core'
import { Meta, Title } from '@angular/platform-browser'
import { RouterLink } from '@angular/router'
import { CoverflowComponent } from '../../components/coverflow/coverflow.component'
import { RevealDirective } from '../../components/reveal/reveal.directive'
import {
  ANNUAL_BILLING_ENABLED,
  ANNUAL_DISCOUNT,
  AUDIENCES,
  AUTOMATION_ITEMS,
  BENEFITS,
  COMPARISON_GROUPS,
  CONTACT_EMAIL,
  FAQS,
  FEATURE_BLOCKS,
  PRICING_NOTES,
  PRICING_PLANS,
  PROBLEMS,
  PRODUCT_TABS,
  SECURITY_ITEMS,
  SOLUTIONS,
  STEPS,
  type PricingPlan,
  type ProductTabId
} from '../../config/landing.config'

@Component({
    selector: 'app-landing',
    imports: [CommonModule, RouterLink, CoverflowComponent, RevealDirective],
    template: `
    <!-- Sprite de ícones: definido uma vez, referenciado via <use> -->
    <svg class="lp-sprite" aria-hidden="true" focusable="false">
      <symbol id="i-cloud" viewBox="0 0 24 24"><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97 6 6 0 0 0-11.66-1.4A4 4 0 0 0 6.5 19z"/></symbol>
      <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l7 3v5.5c0 4.3-2.9 8.2-7 9.5-4.1-1.3-7-5.2-7-9.5V6z"/><path d="M9.2 12.2l2 2 3.6-3.8"/></symbol>
      <symbol id="i-devices" viewBox="0 0 24 24"><rect x="2" y="4" width="14" height="10" rx="1.5"/><path d="M6 18h7"/><rect x="17" y="10" width="5" height="9" rx="1.5"/></symbol>
      <symbol id="i-bolt" viewBox="0 0 24 24"><path d="M13 3L5 13h5l-1 8 8-10h-5z"/></symbol>
      <symbol id="i-chat" viewBox="0 0 24 24"><path d="M20 12a7 7 0 0 1-7 7H8l-4 3v-4.5A7 7 0 0 1 11 5h2a7 7 0 0 1 7 7z"/></symbol>
      <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v10"/><path d="M8.5 11L12 14.5 15.5 11"/><path d="M5 18h14"/></symbol>
      <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/></symbol>
      <symbol id="i-layers" viewBox="0 0 24 24"><path d="M12 4l8 4-8 4-8-4z"/><path d="M4 12.5l8 4 8-4"/><path d="M4 16.5l8 4 8-4"/></symbol>
      <symbol id="i-chart" viewBox="0 0 24 24"><path d="M5 19V11"/><path d="M12 19V5"/><path d="M19 19v-6"/></symbol>
      <symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 19.5S4.5 14.8 4.5 9.9A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7.5 1.9c0 4.9-7.5 9.6-7.5 9.6z"/></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
      <symbol id="i-x" viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></symbol>
      <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"/></symbol>
      <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h13"/><path d="M13 6.5l5.5 5.5L13 17.5"/></symbol>
      <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16 5.6a3.2 3.2 0 0 1 0 6"/><path d="M17.4 14.9c2 .6 3.1 2.3 3.1 4.6"/></symbol>
      <symbol id="i-tooth" viewBox="0 0 24 24"><path d="M12 3c-2 0-2.6 1-4.5 1S4 4.6 4 7.5c0 3.4 1.3 4.6 1.9 7.4.5 2.4.4 5.1 2.1 5.1 1.9 0 1.4-4.5 4-4.5s2.1 4.5 4 4.5c1.7 0 1.6-2.7 2.1-5.1.6-2.8 1.9-4 1.9-7.4C20 4.6 18.4 4 16.5 4S14 3 12 3z"/></symbol>
    </svg>

    <div class="lp" [class.lp--scrolled]="scrolled()">
      <a class="lp-skip" href="#conteudo">Ir para o conteúdo</a>

      <header class="lp-header" role="banner">
        <div class="lp-header-inner">
          <a class="lp-brand" routerLink="/" aria-label="OdontoApp — página inicial">
            <img
              class="lp-brand-mark"
              src="assets/logo-mark-96.png"
              srcset="assets/logo-mark-96.png 1x, assets/logo-mark-192.png 2x"
              width="40" height="40" alt="" aria-hidden="true" decoding="async"
            />
            <span class="lp-brand-name">Odonto<strong>App</strong></span>
          </a>

          <nav class="lp-nav" aria-label="Navegação principal">
            <a href="#recursos">Recursos</a>
            <a href="#para-quem">Para quem é</a>
            <a href="#planos">Planos</a>
            <a href="#seguranca">Segurança</a>
            <a href="#faq">Perguntas</a>
          </nav>

          <div class="lp-header-actions">
            <a class="lp-btn lp-btn-ghost" routerLink="/login">Entrar</a>
            <a class="lp-btn lp-btn-primary" routerLink="/signup">Testar grátis</a>
          </div>

          <button
            type="button"
            class="lp-burger"
            [attr.aria-expanded]="menuOpen()"
            aria-controls="lp-mobile-menu"
            (click)="toggleMenu()"
          >
            <span class="sr-only">{{ menuOpen() ? 'Fechar menu' : 'Abrir menu' }}</span>
            <span class="lp-burger-bars" [class.is-open]="menuOpen()" aria-hidden="true"><i></i><i></i><i></i></span>
          </button>
        </div>

        @if (menuOpen()) {
          <div class="lp-mobile-menu" id="lp-mobile-menu">
            <a href="#recursos" (click)="closeMenu()">Recursos</a>
            <a href="#para-quem" (click)="closeMenu()">Para quem é</a>
            <a href="#planos" (click)="closeMenu()">Planos</a>
            <a href="#seguranca" (click)="closeMenu()">Segurança</a>
            <a href="#faq" (click)="closeMenu()">Perguntas frequentes</a>
            <div class="lp-mobile-menu-cta">
              <a class="lp-btn lp-btn-outline lp-btn-block" routerLink="/login" (click)="closeMenu()">Entrar</a>
              <a class="lp-btn lp-btn-primary lp-btn-block" routerLink="/signup" (click)="closeMenu()">Testar grátis</a>
            </div>
          </div>
        }
      </header>

      <main id="conteudo">
        <!-- ───────────────────────── HERO ───────────────────────── -->
        <section class="lp-hero">
          <div class="lp-hero-bg" aria-hidden="true">
            <span class="lp-hero-glow lp-hero-glow--a"></span>
            <span class="lp-hero-glow lp-hero-glow--b"></span>
            <span class="lp-hero-wordmark">OdontoApp</span>
          </div>
          <div class="lp-shell lp-hero-grid">
            <div class="lp-hero-copy">
              <p class="lp-hero-badge">
                <svg aria-hidden="true" viewBox="0 0 24 24"><use href="#i-tooth"/></svg>
                Sistema de gestão para clínicas odontológicas
              </p>
              <h1>
                Menos tarefas manuais.<br />
                <span class="lp-hl">Mais tempo para cuidar dos seus pacientes.</span>
              </h1>
              <p class="lp-lead">
                O OdontoApp reúne agenda, pacientes, prontuário e financeiro em uma plataforma
                simples, segura e acessível de qualquer lugar.
              </p>
              <div class="lp-hero-cta">
                <a class="lp-btn lp-btn-primary lp-btn-lg" routerLink="/signup">
                  Testar grátis por 7 dias
                  <svg class="lp-btn-icon" aria-hidden="true" viewBox="0 0 24 24"><use href="#i-arrow"/></svg>
                </a>
                <a class="lp-btn lp-btn-outline lp-btn-lg" [href]="demoMailto">Agendar uma demonstração</a>
              </div>
              <ul class="lp-hero-assurances">
                <li><svg aria-hidden="true" viewBox="0 0 24 24"><use href="#i-check"/></svg> Sem cartão de crédito</li>
                <li><svg aria-hidden="true" viewBox="0 0 24 24"><use href="#i-check"/></svg> Cancele quando quiser</li>
                <li><svg aria-hidden="true" viewBox="0 0 24 24"><use href="#i-check"/></svg> Suporte humanizado</li>
              </ul>
            </div>

            <figure class="lp-hero-visual">
              <!-- Cartões soltos sobre a moldura: dão profundidade e mostram dois momentos
                   reais do produto (confirmação do paciente e receita do mês). -->
              <div class="lp-hero-float lp-hero-float--confirm" aria-hidden="true">
                <span class="lp-hero-float-icon is-ok"><svg viewBox="0 0 24 24"><use href="#i-check"/></svg></span>
                <div>
                  <strong>Consulta confirmada</strong>
                  <small>Ana Ribeiro · 09:30</small>
                </div>
              </div>
              <div class="lp-hero-float lp-hero-float--revenue" aria-hidden="true">
                <span class="lp-hero-float-icon"><svg viewBox="0 0 24 24"><use href="#i-chart"/></svg></span>
                <div>
                  <small>Receita do mês</small>
                  <strong>R$ 18.240</strong>
                </div>
              </div>

              <div class="lp-app" aria-hidden="true">
                <div class="lp-app-bar"><i></i><i></i><i></i><span>OdontoApp</span></div>
                <div class="lp-app-body">
                  <aside class="lp-app-side">
                    <span class="lp-app-side-item is-active"></span>
                    <span class="lp-app-side-item"></span>
                    <span class="lp-app-side-item"></span>
                    <span class="lp-app-side-item"></span>
                  </aside>
                  <div class="lp-app-main">
                    <div class="lp-app-kpis">
                      <div class="lp-app-kpi"><small>Pacientes</small><strong>248</strong></div>
                      <div class="lp-app-kpi"><small>Consultas hoje</small><strong>12</strong></div>
                      <div class="lp-app-kpi"><small>Receita do mês</small><strong>R$ 18.240</strong></div>
                    </div>
                    <div class="lp-app-panel">
                      <div class="lp-app-panel-head"><span>Agenda de hoje</span></div>
                      <ul class="lp-app-rows">
                        <li><em>08:00</em><span>Ana Ribeiro</span><b class="is-done">Concluído</b></li>
                        <li><em>09:30</em><span>Carlos Menezes</span><b class="is-sched">Agendado</b></li>
                        <li><em>11:00</em><span>Juliana Prado</span><b class="is-sched">Agendado</b></li>
                        <li><em>14:00</em><span>Marcos Vieira</span><b class="is-cancel">Cancelado</b></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <figcaption class="sr-only">
                Ilustração da interface do OdontoApp: painel com indicadores da clínica e agenda do dia.
              </figcaption>
            </figure>
          </div>
        </section>

        <!-- ──────────────────── FAIXA DE CONFIANÇA (BENTO) ──────────────────── -->
        <section class="lp-trust" aria-label="Por que o OdontoApp">
          <div class="lp-shell">
            <div class="lp-bento">
              <article class="lp-bento-tile lp-bento-tile--hero" appReveal>
                <span class="lp-bento-texture" aria-hidden="true"></span>
                <div class="lp-bento-hero-top">
                  <span class="lp-bento-eyebrow">Teste grátis</span>
                  <p class="lp-bento-figure">7 dias</p>
                </div>
                <p class="lp-bento-hero-text">
                  Sem cartão de crédito. Crie sua clínica em minutos e use todos os módulos do sistema.
                </p>
              </article>

              <article class="lp-bento-tile lp-bento-tile--wide" [appReveal]="80">
                <div>
                  <p class="lp-bento-label">Tudo em um só lugar</p>
                  <p class="lp-bento-figure lp-bento-figure--sm">4 módulos</p>
                </div>
                <ul class="lp-bento-chips">
                  <li>Agenda</li><li>Pacientes</li><li>Prontuário</li><li>Financeiro</li>
                </ul>
              </article>

              <article class="lp-bento-tile lp-bento-tile--pair" [appReveal]="140">
                <span class="lp-bento-badge" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><use href="#i-shield"/></svg>
                </span>
                <div>
                  <p class="lp-bento-tile-title">Dados isolados</p>
                  <p class="lp-bento-label">Um banco exclusivo por clínica</p>
                </div>
              </article>

              <article class="lp-bento-tile lp-bento-tile--pair" [appReveal]="200">
                <span class="lp-bento-badge" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><use href="#i-devices"/></svg>
                </span>
                <div>
                  <p class="lp-bento-tile-title">Computador ou celular</p>
                  <p class="lp-bento-label">Sem instalar nada</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <!-- ──────────────────── PROBLEMA E SOLUÇÃO ──────────────────── -->
        <section class="lp-section lp-problem">
          <div class="lp-shell">
            <header class="lp-section-head">
              <p class="lp-eyebrow">O problema</p>
              <h2>Sua clínica não precisa depender de planilhas, papéis e processos manuais.</h2>
            </header>
            <div class="lp-compare">
              <article class="lp-compare-card lp-compare-card--problem" appReveal>
                <h3>Como costuma ser hoje</h3>
                <ul>
                  @for (p of problems; track p) {
                    <li><svg aria-hidden="true" viewBox="0 0 24 24"><use href="#i-x"/></svg><span>{{ p }}</span></li>
                  }
                </ul>
              </article>
              <article class="lp-compare-card lp-compare-card--solution" [appReveal]="120">
                <h3>Com o OdontoApp</h3>
                <ul>
                  @for (s of solutions; track s) {
                    <li><svg aria-hidden="true" viewBox="0 0 24 24"><use href="#i-check"/></svg><span>{{ s }}</span></li>
                  }
                </ul>
              </article>
            </div>
          </div>
        </section>

        <!-- ──────────────────── PRODUTO (TABS) ──────────────────── -->
        <section class="lp-section lp-product" id="recursos">
          <div class="lp-shell">
            <header class="lp-section-head lp-section-head--center">
              <p class="lp-eyebrow">Visão completa</p>
              <h2>Tudo o que sua clínica precisa, em uma única plataforma.</h2>
              <p class="lp-section-sub">Navegue pelas áreas do sistema e veja o que cada uma resolve na rotina.</p>
            </header>

            <app-coverflow
              [slides]="carouselSlides"
              [slideTemplate]="appPreview"
              [index]="activeTabIndex()"
              (indexChange)="selectTabByIndex($event)"
              label="Telas do sistema"
            />

            <div
              class="lp-tab-caption"
              role="tabpanel"
              [id]="'cf-panel-' + activeTab()"
              [attr.aria-labelledby]="'cf-tab-' + activeTab()"
            >
              <h3>{{ activeTabData().title }}</h3>
              <p>{{ activeTabData().description }}</p>
              <ul class="lp-outcomes">
                @for (o of activeTabData().outcomes; track o) {
                  <li><svg aria-hidden="true" viewBox="0 0 24 24"><use href="#i-check"/></svg><span>{{ o }}</span></li>
                }
              </ul>
            </div>
          </div>
        </section>

        <!-- ──────────────────── BLOCOS DE FUNCIONALIDADES ──────────────────── -->
        <section class="lp-section lp-features">
          <div class="lp-shell">
            @for (block of featureBlocks; track block.title; let i = $index) {
              <article class="lp-feature-row" [class.is-reversed]="i % 2 === 1" appReveal>
                <div class="lp-feature-copy">
                  <p class="lp-eyebrow">{{ block.eyebrow }}</p>
                  <h3>{{ block.title }}</h3>
                  <p class="lp-feature-desc">{{ block.description }}</p>
                  <ul class="lp-feature-list">
                    @for (item of block.items; track item.label) {
                      <li [class.is-soon]="item.status === 'soon'">
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <use [attr.href]="item.status === 'ready' ? '#i-check' : '#i-clock'"/>
                        </svg>
                        <span>{{ item.label }}</span>
                        @if (item.status === 'soon') { <span class="lp-soon">Em breve</span> }
                      </li>
                    }
                  </ul>
                </div>
                <div class="lp-feature-visual">
                  <ng-container [ngTemplateOutlet]="appPreview" [ngTemplateOutletContext]="{ $implicit: block.visual }" />
                </div>
              </article>
            }
          </div>
        </section>

        <!-- ──────────────────── AUTOMAÇÕES (ROADMAP) ──────────────────── -->
        <section class="lp-section lp-roadmap">
          <div class="lp-shell lp-roadmap-inner">
            <div class="lp-roadmap-copy">
              <p class="lp-eyebrow">No nosso roteiro</p>
              <h2>Automações de relacionamento</h2>
              <p>
                Ainda não estão disponíveis. Estamos construindo esta etapa e ela será liberada
                para todos os planos conforme cada recurso ficar pronto.
              </p>
            </div>
            <ul class="lp-roadmap-list">
              @for (item of automationItems; track item.label) {
                <li><span>{{ item.label }}</span><span class="lp-soon">Em breve</span></li>
              }
            </ul>
          </div>
        </section>

        <!-- ──────────────────── BENEFÍCIOS ──────────────────── -->
        <section class="lp-section lp-benefits">
          <div class="lp-shell">
            <header class="lp-section-head lp-section-head--center">
              <p class="lp-eyebrow">Benefícios</p>
              <h2>Mais organização para a equipe. Mais tranquilidade para o dentista.</h2>
            </header>
            <div class="lp-benefit-grid">
              @for (b of benefits; track b.title; let i = $index) {
                <article class="lp-benefit-card" [appReveal]="i * 90">
                  <span class="lp-benefit-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><use [attr.href]="'#i-' + b.icon"/></svg>
                  </span>
                  <h3>{{ b.title }}</h3>
                  <p>{{ b.description }}</p>
                </article>
              }
            </div>
          </div>
        </section>

        <!-- ──────────────────── PARA QUEM É ──────────────────── -->
        <section class="lp-section lp-audience" id="para-quem">
          <div class="lp-shell">
            <header class="lp-section-head lp-section-head--center">
              <p class="lp-eyebrow">Para quem é</p>
              <h2>Feito para a rotina de quem atende</h2>
            </header>
            <div class="lp-audience-grid">
              @for (a of audiences; track a.title; let i = $index) {
                <article class="lp-audience-card" [appReveal]="i * 90">
                  <h3>{{ a.title }}</h3>
                  <p>{{ a.description }}</p>
                </article>
              }
            </div>
          </div>
        </section>

        <!-- ──────────────────── COMO FUNCIONA ──────────────────── -->
        <section class="lp-section lp-steps">
          <div class="lp-shell">
            <header class="lp-section-head lp-section-head--center">
              <p class="lp-eyebrow">Como funciona</p>
              <h2>Comece em três passos</h2>
            </header>
            <ol class="lp-step-grid">
              @for (s of steps; track s.number; let i = $index) {
                <li class="lp-step" [appReveal]="i * 110">
                  <span class="lp-step-num" aria-hidden="true">{{ s.number }}</span>
                  <h3>{{ s.title }}</h3>
                  <p>{{ s.description }}</p>
                </li>
              }
            </ol>
            <div class="lp-steps-cta">
              <a class="lp-btn lp-btn-primary lp-btn-lg" routerLink="/signup">Começar meu teste grátis</a>
            </div>
          </div>
        </section>

        <!-- ──────────────────── SEGURANÇA ──────────────────── -->
        <section class="lp-section lp-security" id="seguranca">
          <div class="lp-shell">
            <header class="lp-section-head lp-section-head--center">
              <p class="lp-eyebrow lp-eyebrow--light">Segurança e privacidade</p>
              <h2>Os dados dos seus pacientes tratados com seriedade</h2>
              <p class="lp-section-sub">
                Abaixo estão apenas práticas que já estão implementadas no sistema.
              </p>
            </header>
            <div class="lp-security-grid">
              @for (s of securityItems; track s.title; let i = $index) {
                <article class="lp-security-card" [appReveal]="i * 70">
                  <svg class="lp-security-icon" aria-hidden="true" viewBox="0 0 24 24"><use href="#i-lock"/></svg>
                  <h3>{{ s.title }}</h3>
                  <p>{{ s.description }}</p>
                </article>
              }
            </div>
            <p class="lp-security-note">
              <a href="/assets/politica-de-privacidade.html" target="_blank" rel="noopener">Política de privacidade</a>
              <span aria-hidden="true">·</span>
              <a href="/assets/termos-de-uso.html" target="_blank" rel="noopener">Termos de uso</a>
            </p>
          </div>
        </section>

        <!-- ──────────────────── PLANOS ──────────────────── -->
        <section class="lp-section lp-pricing" id="planos">
          <div class="lp-shell">
            <header class="lp-section-head lp-section-head--center">
              <p class="lp-eyebrow">Planos simples e transparentes</p>
              <h2>Escolha o plano ideal para sua clínica</h2>
            </header>

            <div class="lp-cycle" role="group" aria-label="Ciclo de cobrança">
              <button
                type="button"
                class="lp-cycle-btn"
                [class.is-active]="!annual()"
                [attr.aria-pressed]="!annual()"
                (click)="setAnnual(false)"
              >Mensal</button>
              <button
                type="button"
                class="lp-cycle-btn"
                [class.is-active]="annual()"
                [attr.aria-pressed]="annual()"
                (click)="setAnnual(true)"
              >Anual <span class="lp-cycle-tag">-10%</span></button>
            </div>

            @if (annual() && !annualEnabled) {
              <p class="lp-cycle-warning" role="status">
                A cobrança anual ainda não está disponível — os valores abaixo são uma prévia.
                Ao contratar agora, a assinatura é mensal.
              </p>
            }
            @if (annual() && annualEnabled) {
              <p class="lp-cycle-legal" role="note">
                Cobrança anual à vista, com 10% de desconto sobre o valor mensal. Ao cancelar, o acesso continua até o fim do
                período já pago — não há reembolso proporcional do período restante.
              </p>
            }

            <div class="lp-plan-grid">
              @for (plan of plans; track plan.code; let i = $index) {
                <article class="lp-plan" [class.is-featured]="plan.highlight" [appReveal]="i * 100">
                  @if (plan.highlight) {
                    <span class="lp-plan-badge">{{ plan.highlightLabel }}</span>
                  }
                  <header class="lp-plan-head">
                    <h3>{{ plan.name }}</h3>
                    <p class="lp-plan-tagline">{{ plan.tagline }}</p>
                  </header>

                  <p class="lp-plan-limit">
                    <svg aria-hidden="true" viewBox="0 0 24 24"><use href="#i-users"/></svg>
                    {{ plan.limitLabel }}
                  </p>

                  <p class="lp-plan-price">
                    <span class="lp-plan-currency">R$</span>
                    <strong>{{ displayPrice(plan) }}</strong>
                    <span class="lp-plan-period">/mês</span>
                  </p>
                  @if (annual()) {
                    <p class="lp-plan-price-note">R$ {{ annualTotal(plan) }} cobrados uma vez por ano</p>
                  } @else {
                    <p class="lp-plan-price-note">R$ {{ annualPrice(plan) }}/mês pagando anual — economize R$ {{ annualSaving(plan) }}/ano</p>
                  }

                  <a
                    class="lp-btn lp-btn-block"
                    [class.lp-btn-primary]="plan.highlight"
                    [class.lp-btn-outline]="!plan.highlight"
                    routerLink="/signup"
                    [queryParams]="{ plan: plan.code, cycle: annual() && annualEnabled ? 'annual' : 'monthly' }"
                  >Começar teste grátis</a>

                  <ul class="lp-plan-highlights">
                    @for (f of plan.highlights; track f.label) {
                      <li [class.is-soon]="f.status === 'soon'">
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <use [attr.href]="f.status === 'ready' ? '#i-check' : '#i-clock'"/>
                        </svg>
                        <span>{{ f.label }}</span>
                        @if (f.status === 'soon') { <span class="lp-soon">Em breve</span> }
                      </li>
                    }
                  </ul>

                  <a class="lp-plan-compare-link" href="#comparativo">Ver todos os recursos</a>
                </article>
              }
            </div>

            <ul class="lp-pricing-notes">
              @for (n of pricingNotes; track n) {
                <li><svg aria-hidden="true" viewBox="0 0 24 24"><use href="#i-check"/></svg>{{ n }}</li>
              }
            </ul>

            <!-- Comparativo completo -->
            <div class="lp-compare-wrap" id="comparativo">
              <h3 class="lp-compare-title">Comparativo completo dos planos</h3>
              <div class="lp-table-scroll" tabindex="0" role="region" aria-label="Tabela comparativa de planos">
                <table class="lp-table">
                  <caption class="sr-only">Comparação de recursos entre os planos Essencial, Profissional e Clínica</caption>
                  <thead>
                    <tr>
                      <th scope="col">Recurso</th>
                      <th scope="col">Essencial</th>
                      <th scope="col" class="is-featured">Profissional</th>
                      <th scope="col">Clínica</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (group of comparisonGroups; track group.title) {
                      <tr class="lp-table-group">
                        <th scope="colgroup" colspan="4">{{ group.title }}</th>
                      </tr>
                      @for (row of group.rows; track row.label) {
                        <tr>
                          <th scope="row">
                            {{ row.label }}
                            @if (row.soon) { <span class="lp-soon">Em breve</span> }
                          </th>
                          <td>
                            <ng-container [ngTemplateOutlet]="cell" [ngTemplateOutletContext]="{ $implicit: row.basic }" />
                          </td>
                          <td class="is-featured">
                            <ng-container [ngTemplateOutlet]="cell" [ngTemplateOutletContext]="{ $implicit: row.pro }" />
                          </td>
                          <td>
                            <ng-container [ngTemplateOutlet]="cell" [ngTemplateOutletContext]="{ $implicit: row.clinic }" />
                          </td>
                        </tr>
                      }
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- ──────────────────── COMPROMISSO (sem depoimento falso) ──────────────────── -->
        <section class="lp-section lp-commitment">
          <div class="lp-shell lp-commitment-inner">
            <header class="lp-section-head lp-section-head--center">
              <p class="lp-eyebrow">Nosso compromisso</p>
              <h2>Desenvolvido para simplificar a rotina de clínicas odontológicas</h2>
              <p class="lp-section-sub">
                O OdontoApp é um produto em evolução constante. Preferimos mostrar o que já
                funciona a prometer o que ainda não existe.
              </p>
            </header>
            <div class="lp-commitment-grid">
              <article><h3>Implantação acompanhada</h3><p>Ajudamos você a configurar a clínica e a cadastrar os primeiros pacientes.</p></article>
              <article><h3>Suporte por pessoas</h3><p>Você fala com alguém da equipe, não com um robô de atendimento.</p></article>
              <article><h3>Evolução contínua</h3><p>Novos recursos entram no ar de forma incremental, sem custo adicional no seu plano.</p></article>
              <article><h3>Transparência</h3><p>O que ainda está em desenvolvimento aparece marcado como “Em breve”.</p></article>
            </div>
          </div>
        </section>

        <!-- ──────────────────── FAQ ──────────────────── -->
        <section class="lp-section lp-faq" id="faq">
          <div class="lp-shell lp-faq-inner">
            <header class="lp-section-head lp-section-head--center">
              <p class="lp-eyebrow">Perguntas frequentes</p>
              <h2>Ainda com dúvida?</h2>
            </header>
            <div class="lp-faq-list">
              @for (item of faqs; track item.question; let i = $index) {
                <div class="lp-faq-item" [class.is-open]="openFaq() === i">
                  <h3>
                    <button
                      type="button"
                      class="lp-faq-trigger"
                      [attr.aria-expanded]="openFaq() === i"
                      [attr.aria-controls]="'faq-answer-' + i"
                      [id]="'faq-trigger-' + i"
                      (click)="toggleFaq(i)"
                    >
                      <span>{{ item.question }}</span>
                      <svg class="lp-faq-chevron" aria-hidden="true" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                  </h3>
                  <div
                    class="lp-faq-answer"
                    role="region"
                    [id]="'faq-answer-' + i"
                    [attr.aria-labelledby]="'faq-trigger-' + i"
                    [hidden]="openFaq() !== i"
                  >
                    <p>{{ item.answer }}</p>
                  </div>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- ──────────────────── CTA FINAL ──────────────────── -->
        <section class="lp-section lp-final">
          <div class="lp-shell lp-final-inner">
            <h2>Pronto para simplificar a gestão da sua clínica?</h2>
            <p>
              Comece agora e descubra como o OdontoApp pode tornar sua rotina mais organizada,
              produtiva e previsível.
            </p>
            <div class="lp-final-cta">
              <a class="lp-btn lp-btn-light lp-btn-lg" routerLink="/signup">Testar grátis por 7 dias</a>
              <a class="lp-btn lp-btn-ghost-light lp-btn-lg" [href]="specialistMailto">Falar com um especialista</a>
            </div>
          </div>
        </section>
      </main>

      <!-- ──────────────────── FOOTER ──────────────────── -->
      <footer class="lp-footer" role="contentinfo">
        <div class="lp-shell lp-footer-grid">
          <div class="lp-footer-brand">
            <a class="lp-brand" routerLink="/" aria-label="OdontoApp">
              <span class="lp-brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#i-tooth"/></svg></span>
              <span class="lp-brand-name">Odonto<strong>App</strong></span>
            </a>
            <p>Sistema de gestão para clínicas odontológicas que buscam mais organização, produtividade e crescimento.</p>
          </div>

          <nav aria-label="Produto">
            <h2>Produto</h2>
            <a href="#recursos">Recursos</a>
            <a href="#para-quem">Para quem é</a>
            <a href="#planos">Planos</a>
            <a href="#seguranca">Segurança</a>
          </nav>

          <nav aria-label="Suporte">
            <h2>Suporte</h2>
            <a href="#faq">Perguntas frequentes</a>
            <a [href]="supportMailto">Central de ajuda</a>
            <a [href]="specialistMailto">Falar com especialista</a>
            <a routerLink="/login">Entrar no sistema</a>
          </nav>

          <nav aria-label="Institucional">
            <h2>Institucional</h2>
            <a href="/assets/termos-de-uso.html" target="_blank" rel="noopener">Termos de uso</a>
            <a href="/assets/politica-de-privacidade.html" target="_blank" rel="noopener">Política de privacidade</a>
            <a href="/assets/politica-de-privacidade.html" target="_blank" rel="noopener">LGPD</a>
            <a [href]="supportMailto">Contato</a>
          </nav>
        </div>
        <div class="lp-shell lp-footer-bottom">
          <p>© {{ year }} OdontoApp. Todos os direitos reservados.</p>
          <p><a [href]="supportMailto">{{ contactEmail }}</a></p>
        </div>
      </footer>

      <!-- CTA fixo no mobile -->
      <div class="lp-sticky-cta" [class.is-visible]="scrolled()">
        <a class="lp-btn lp-btn-primary lp-btn-block" routerLink="/signup">Testar grátis por 7 dias</a>
      </div>
    </div>

    <!-- Célula da tabela comparativa: booleano vira ícone, texto vira texto -->
    <ng-template #cell let-value>
      @if (value === true) {
        <svg class="lp-cell-yes" viewBox="0 0 24 24" role="img" aria-label="Incluído"><use href="#i-check"/></svg>
      } @else if (value === false) {
        <svg class="lp-cell-no" viewBox="0 0 24 24" role="img" aria-label="Não incluído"><use href="#i-x"/></svg>
      } @else {
        <span>{{ value }}</span>
      }
    </ng-template>

    <!-- ──────────── Prévia da interface, reutilizada em tabs e blocos ──────────── -->
    <ng-template #appPreview let-view>
      <div class="lp-app lp-app--inline" aria-hidden="true">
        <div class="lp-app-bar"><i></i><i></i><i></i><span>OdontoApp</span></div>
        <div class="lp-app-body">
          <aside class="lp-app-side">
            <span class="lp-app-side-item" [class.is-active]="view === 'overview'"></span>
            <span class="lp-app-side-item" [class.is-active]="view === 'agenda'"></span>
            <span class="lp-app-side-item" [class.is-active]="view === 'patients'"></span>
            <span class="lp-app-side-item" [class.is-active]="view === 'records' || view === 'finance'"></span>
          </aside>
          <div class="lp-app-main">
            @switch (view) {
              @case ('agenda') {
                <div class="lp-app-panel">
                  <div class="lp-app-panel-head"><span>Agenda</span><i class="lp-app-chip"></i></div>
                  <ul class="lp-app-rows">
                    <li><em>08:00</em><span>Ana Ribeiro</span><b class="is-done">Concluído</b></li>
                    <li><em>09:30</em><span>Carlos Menezes</span><b class="is-sched">Agendado</b></li>
                    <li><em>11:00</em><span>Juliana Prado</span><b class="is-sched">Agendado</b></li>
                    <li><em>13:30</em><span>Rafael Lima</span><b class="is-sched">Agendado</b></li>
                    <li><em>15:00</em><span>Marcos Vieira</span><b class="is-cancel">Cancelado</b></li>
                  </ul>
                </div>
              }
              @case ('patients') {
                <div class="lp-app-panel">
                  <div class="lp-app-panel-head"><span>Pacientes</span><i class="lp-app-chip"></i></div>
                  <ul class="lp-app-rows lp-app-rows--patients">
                    <li><i class="lp-app-avatar">AR</i><span>Ana Ribeiro</span><em>(27) 9····-1180</em></li>
                    <li><i class="lp-app-avatar">CM</i><span>Carlos Menezes</span><em>(27) 9····-4432</em></li>
                    <li><i class="lp-app-avatar">JP</i><span>Juliana Prado</span><em>(27) 9····-7781</em></li>
                    <li><i class="lp-app-avatar">RL</i><span>Rafael Lima</span><em>(27) 9····-2093</em></li>
                  </ul>
                </div>
              }
              @case ('records') {
                <div class="lp-app-panel">
                  <div class="lp-app-panel-head"><span>Prontuário · Ana Ribeiro</span></div>
                  <ul class="lp-app-timeline">
                    <li><em>12 mar</em><div><b></b><b class="short"></b></div></li>
                    <li><em>28 fev</em><div><b></b><b class="mid"></b></div></li>
                    <li><em>05 fev</em><div><b></b><b class="short"></b></div></li>
                  </ul>
                  <div class="lp-app-files"><span></span><span></span><span></span></div>
                </div>
              }
              @case ('finance') {
                <div class="lp-app-panel">
                  <div class="lp-app-panel-head"><span>Financeiro</span></div>
                  <div class="lp-app-kpis lp-app-kpis--two">
                    <div class="lp-app-kpi"><small>Recebido no mês</small><strong>R$ 18.240</strong></div>
                    <div class="lp-app-kpi"><small>Em aberto</small><strong>7</strong></div>
                  </div>
                  <ul class="lp-app-rows">
                    <li><em>R$ 480</em><span>Ana Ribeiro</span><b class="is-done">Pago</b></li>
                    <li><em>R$ 1.200</em><span>Carlos Menezes</span><b class="is-pend">Pendente</b></li>
                    <li><em>R$ 320</em><span>Juliana Prado</span><b class="is-done">Pago</b></li>
                  </ul>
                </div>
              }
              @default {
                <div class="lp-app-kpis">
                  <div class="lp-app-kpi"><small>Pacientes</small><strong>248</strong></div>
                  <div class="lp-app-kpi"><small>Consultas hoje</small><strong>12</strong></div>
                  <div class="lp-app-kpi"><small>Receita do mês</small><strong>R$ 18.240</strong></div>
                </div>
                <div class="lp-app-panel">
                  <div class="lp-app-panel-head"><span>Novos pacientes</span></div>
                  <div class="lp-app-chartbars"><i style="height:38%"></i><i style="height:52%"></i><i style="height:44%"></i><i style="height:70%"></i><i style="height:61%"></i><i style="height:86%"></i></div>
                </div>
              }
            }
          </div>
        </div>
      </div>
    </ng-template>
  `
})
export class LandingComponent implements OnInit, OnDestroy {
  private readonly title = inject(Title)
  private readonly meta = inject(Meta)
  private readonly document = inject(DOCUMENT)

  private previousTitle = ''
  private previousDescription = ''
  private injectedNodes: HTMLElement[] = []

  readonly problems = PROBLEMS
  readonly solutions = SOLUTIONS
  readonly productTabs = PRODUCT_TABS
  readonly featureBlocks = FEATURE_BLOCKS
  readonly automationItems = AUTOMATION_ITEMS
  readonly benefits = BENEFITS
  readonly audiences = AUDIENCES
  readonly steps = STEPS
  readonly securityItems = SECURITY_ITEMS
  readonly plans = PRICING_PLANS
  readonly pricingNotes = PRICING_NOTES
  readonly comparisonGroups = COMPARISON_GROUPS
  readonly faqs = FAQS
  readonly annualEnabled = ANNUAL_BILLING_ENABLED
  readonly contactEmail = CONTACT_EMAIL
  readonly year = new Date().getFullYear()

  readonly scrolled = signal(false)
  readonly menuOpen = signal(false)
  readonly activeTab = signal<ProductTabId>('overview')
  readonly annual = signal(false)
  readonly openFaq = signal<number | null>(0)

  /** As mesmas áreas do sistema, no formato que o carrossel consome. */
  readonly carouselSlides = PRODUCT_TABS.map(tab => ({ id: tab.id, label: tab.label }))
  readonly activeTabIndex = computed(() => this.productTabs.findIndex(tab => tab.id === this.activeTab()))
  readonly activeTabData = computed(() => this.productTabs.find(tab => tab.id === this.activeTab()) ?? this.productTabs[0])

  readonly demoMailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Quero agendar uma demonstração do OdontoApp')}`
  readonly specialistMailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Quero falar com um especialista do OdontoApp')}`
  readonly supportMailto = `mailto:${CONTACT_EMAIL}`

  @HostListener('window:scroll')
  onScroll() {
    this.scrolled.set((this.document.defaultView?.scrollY ?? 0) > 24)
  }

  toggleMenu() {
    this.menuOpen.update(v => !v)
  }

  closeMenu() {
    this.menuOpen.set(false)
  }

  selectTabByIndex(index: number) {
    const tab = this.productTabs[index]
    if (tab) this.activeTab.set(tab.id)
  }

  setAnnual(value: boolean) {
    this.annual.set(value)
  }

  toggleFaq(index: number) {
    this.openFaq.update(current => (current === index ? null : index))
  }

  /** Formato monetário pt-BR: o total anual passa de mil, então precisa do separador de milhar. */
  formatCents(cents: number) {
    return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  /** 10% de desconto arredondado para baixo na dezena de centavos (79,90 → 71,90). */
  private annualMonthlyCents(plan: PricingPlan) {
    return Math.floor((plan.priceCents * (1 - ANNUAL_DISCOUNT)) / 10) * 10
  }

  annualPrice(plan: PricingPlan) {
    return this.formatCents(this.annualMonthlyCents(plan))
  }

  /** Valor cobrado de uma vez no ciclo anual — espelha annualTotalCents do backend. */
  annualTotal(plan: PricingPlan) {
    return this.formatCents(this.annualMonthlyCents(plan) * 12)
  }

  annualSaving(plan: PricingPlan) {
    return this.formatCents((plan.priceCents - this.annualMonthlyCents(plan)) * 12)
  }

  displayPrice(plan: PricingPlan) {
    return this.annual() ? this.annualPrice(plan) : this.formatCents(plan.priceCents)
  }

  ngOnInit() {
    this.previousTitle = this.title.getTitle()
    this.previousDescription = this.meta.getTag('name="description"')?.content || ''

    const pageTitle = 'OdontoApp | Software Odontológico'
    const description =
      'Organize agenda, pacientes, tratamentos e financeiro da sua clínica odontológica em uma plataforma simples, segura e acessível de qualquer lugar.'
    const origin = this.document.location?.origin || ''

    this.title.setTitle(pageTitle)
    this.meta.updateTag({ name: 'description', content: description })
    this.meta.updateTag({ property: 'og:title', content: pageTitle })
    this.meta.updateTag({ property: 'og:description', content: description })
    this.meta.updateTag({ property: 'og:type', content: 'website' })
    this.meta.updateTag({ property: 'og:locale', content: 'pt_BR' })
    if (origin) this.meta.updateTag({ property: 'og:url', content: origin })
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' })
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle })
    this.meta.updateTag({ name: 'twitter:description', content: description })

    this.ensureCanonical(origin)
    this.injectStructuredData(origin, description)
    this.onScroll()
  }

  ngOnDestroy() {
    if (this.previousTitle) this.title.setTitle(this.previousTitle)
    if (this.previousDescription) {
      this.meta.updateTag({ name: 'description', content: this.previousDescription })
    }
    this.injectedNodes.forEach(node => node.remove())
    this.injectedNodes = []
  }

  private ensureCanonical(origin: string) {
    const head = this.document.head
    if (!head) return
    let link: HTMLLinkElement | null = head.querySelector('link[rel="canonical"]')
    if (!link) {
      link = this.document.createElement('link')
      link.setAttribute('rel', 'canonical')
      head.appendChild(link)
    }
    link.setAttribute('href', origin)
  }

  /** Schema.org SoftwareApplication + FAQPage. */
  private injectStructuredData(origin: string, description: string) {
    const head = this.document.head
    if (!head) return

    const software = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'OdontoApp',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description,
      ...(origin ? { url: origin } : {}),
      offers: this.plans.map(plan => ({
        '@type': 'Offer',
        name: plan.name,
        price: (plan.priceCents / 100).toFixed(2),
        priceCurrency: 'BRL',
        category: 'subscription'
      }))
    }

    const faqPage = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faqs.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer }
      }))
    }

    for (const payload of [software, faqPage]) {
      const script = this.document.createElement('script')
      script.type = 'application/ld+json'
      script.textContent = JSON.stringify(payload)
      head.appendChild(script)
      this.injectedNodes.push(script)
    }
  }
}
