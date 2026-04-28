import { Component } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink } from '@angular/router'

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="landing-page">
      <header class="landing-nav">
        <a routerLink="/" class="landing-brand">
          <span class="landing-brand-mark">O</span>
          <span>Odonto SaaS</span>
        </a>
        <div class="landing-nav-actions">
          <a routerLink="/login" class="btn btn-ghost">Entrar</a>
          <a routerLink="/signup" class="btn btn-primary">Começar agora</a>
        </div>
      </header>

      <section class="landing-hero">
        <div class="landing-hero-content">
          <span class="landing-chip">SaaS odontológico multi-tenant</span>
          <h1>Venda e opere sua clínica em uma plataforma pronta para escalar</h1>
          <p>
            Agenda, pacientes, prontuário, assinatura recorrente e onboarding automático em um único fluxo.
            Você cadastra, paga e entra no sistema em minutos.
          </p>
          <div class="landing-hero-cta">
            <a routerLink="/signup" class="btn btn-primary">Criar conta e assinar</a>
            <a routerLink="/login" class="btn btn-outline">Já tenho acesso</a>
          </div>
          <div class="landing-proof">
            <span>Provisionamento de clínica automático</span>
            <span>Pagamento recorrente com confirmação via webhook</span>
            <span>Isolamento completo por tenant</span>
          </div>
        </div>

        <div class="landing-hero-card">
          <h3>Fluxo comercial pronto</h3>
          <ul>
            <li>Landing de conversão</li>
            <li>Cadastro público da clínica</li>
            <li>Checkout de assinatura mensal</li>
            <li>Ativação imediata após pagamento</li>
          </ul>
          <a routerLink="/signup" class="btn btn-primary btn-block">Iniciar onboarding</a>
        </div>
      </section>

      <section class="landing-features">
        <article class="landing-feature-card">
          <h3>Onboarding sem atrito</h3>
          <p>Cadastro, escolha de plano e pagamento em um fluxo guiado para reduzir abandono.</p>
        </article>
        <article class="landing-feature-card">
          <h3>Segurança multi-tenant</h3>
          <p>Cada clínica tem banco isolado e autenticação própria, com barreiras entre tenants.</p>
        </article>
        <article class="landing-feature-card">
          <h3>Operação e gestão central</h3>
          <p>Painel master para monitorar clínicas, assinatura, financeiro e saúde operacional.</p>
        </article>
      </section>

      <section class="landing-pricing" id="planos">
        <div class="landing-section-title">
          <h2>Planos simples e mensais</h2>
          <p>Comece com o plano ideal e faça upgrade conforme a clínica cresce.</p>
        </div>
        <div class="landing-pricing-grid">
          <article class="landing-plan-card">
            <h3>Basic</h3>
            <strong>R$ 49<span>/mês</span></strong>
            <ul>
              <li>Agenda e pacientes</li>
              <li>Prontuário digital</li>
              <li>1 clínica com isolamento completo</li>
            </ul>
            <a routerLink="/signup" class="btn btn-outline btn-block">Escolher Basic</a>
          </article>
          <article class="landing-plan-card featured">
            <span class="landing-plan-badge">Mais escolhido</span>
            <h3>Pro</h3>
            <strong>R$ 99<span>/mês</span></strong>
            <ul>
              <li>Tudo do Basic</li>
              <li>Visão operacional avançada</li>
              <li>Escala para equipes maiores</li>
            </ul>
            <a routerLink="/signup" class="btn btn-primary btn-block">Escolher Pro</a>
          </article>
        </div>
      </section>

      <section class="landing-testimonials">
        <div class="landing-section-title">
          <h2>Prova de confiança</h2>
          <p>Uma base pronta para operar SaaS odontológico com crescimento sustentável.</p>
        </div>
        <div class="landing-quotes">
          <blockquote>
            “Em menos de um dia estruturamos cadastro, cobrança e ativação de clínicas.”
            <cite>Equipe de Operações</cite>
          </blockquote>
          <blockquote>
            “O isolamento por tenant trouxe segurança para escalar sem retrabalho.”
            <cite>Equipe de Tecnologia</cite>
          </blockquote>
        </div>
      </section>

      <section class="landing-final-cta">
        <h2>Pronto para vender seu SaaS odontológico?</h2>
        <p>Comece com cadastro público e assinatura ativa em poucos passos.</p>
        <a routerLink="/signup" class="btn btn-primary">Começar agora</a>
      </section>
    </div>
  `
})
export class LandingComponent {}
