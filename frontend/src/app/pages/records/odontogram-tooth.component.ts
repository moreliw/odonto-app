import { Component, Input } from '@angular/core'

type ToothShape = {
  crown: string
  roots: string[]
  crownDetails?: string[]
  rootDetails?: string[]
}

/*
 * Silhuetas vetoriais redesenhadas a partir da prancha odontológica enviada.
 * Todas usam a orientação mandibular como base; maxila e lado esquerdo são
 * espelhados por transformação para manter a anatomia posicional FDI.
 */
const TOOTH_SHAPES: Record<string, ToothShape> = {
  PERMANENT_MAXILLARY_1: {
    crown: 'M14 10 C14 6 18 4 24 5 C31 6 40 5 49 5 C55 5 59 9 58 16 L55 39 C54 49 48 55 39 57 C29 59 21 54 18 45 C16 36 15 22 14 10 Z',
    roots: ['M27 54 C28 68 30 86 33 104 C34 110 37 112 40 107 C44 89 47 69 47 54 C41 49 33 49 27 54 Z'],
    crownDetails: ['M20 16 C27 12 42 11 52 15', 'M22 43 C28 49 43 51 51 42'],
    rootDetails: ['M33 58 C34 73 35 88 36 101']
  },
  PERMANENT_MAXILLARY_2: {
    crown: 'M19 11 C19 7 23 5 28 6 C34 7 40 5 46 6 C51 7 54 11 53 17 L51 40 C50 49 45 54 37 56 C29 57 22 52 21 44 C20 34 20 22 19 11 Z',
    roots: ['M28 53 C29 70 30 88 33 104 C34 110 37 111 40 106 C44 88 45 70 44 53 C39 49 33 49 28 53 Z'],
    crownDetails: ['M24 16 C31 13 42 12 49 16', 'M25 42 C31 47 42 48 48 41'],
    rootDetails: ['M34 58 C34 74 35 88 36 101']
  },
  PERMANENT_MAXILLARY_3: {
    crown: 'M35 5 C38 4 40 9 43 15 C47 23 51 31 52 39 C53 47 47 54 39 57 C30 59 21 54 20 46 C19 38 24 30 28 22 C31 16 32 7 35 5 Z',
    roots: ['M27 53 C27 67 29 86 32 105 C33 112 37 113 40 107 C44 89 47 68 46 53 C40 48 33 48 27 53 Z'],
    crownDetails: ['M24 43 C29 48 42 51 48 42'],
    rootDetails: ['M34 57 C35 74 35 91 36 103']
  },
  PERMANENT_MAXILLARY_4: {
    crown: 'M13 17 C15 11 21 9 27 12 C31 8 37 7 43 11 C49 14 53 19 54 27 L52 42 C50 50 43 55 34 56 C24 57 16 52 14 44 C12 35 11 25 13 17 Z',
    roots: ['M24 52 C21 65 18 83 17 102 C17 108 20 111 23 107 C29 94 31 76 33 55 Z', 'M36 54 C39 72 42 91 47 104 C49 109 53 108 54 103 C53 84 49 65 46 51 Z'],
    crownDetails: ['M17 25 C23 21 28 22 33 27 C39 21 46 21 50 26', 'M18 42 C27 47 42 48 49 41'],
    rootDetails: ['M27 58 C25 74 22 91 21 102', 'M43 58 C45 74 49 90 50 102']
  },
  PERMANENT_MAXILLARY_5: {
    crown: 'M14 18 C16 12 22 10 28 13 C33 9 40 9 46 13 C51 16 54 22 54 29 L52 43 C49 51 43 55 34 56 C25 57 17 52 15 44 C13 36 12 26 14 18 Z',
    roots: ['M27 53 C27 69 29 87 32 104 C33 110 37 112 40 107 C45 88 47 68 45 53 C39 49 33 49 27 53 Z'],
    crownDetails: ['M18 26 C24 21 29 23 34 28 C40 22 47 22 51 27', 'M19 42 C27 47 42 48 49 41'],
    rootDetails: ['M34 58 C35 75 35 90 36 102']
  },
  PERMANENT_MAXILLARY_6: {
    crown: 'M7 19 C8 13 13 10 20 11 C25 7 31 8 36 12 C41 8 49 9 54 13 C60 17 62 24 61 31 L59 43 C56 51 48 56 36 57 C23 58 12 54 9 46 C7 38 6 27 7 19 Z',
    roots: ['M20 52 C16 65 11 83 8 101 C7 108 10 111 14 107 C22 96 27 75 31 55 Z', 'M31 54 C32 71 33 91 35 106 C36 111 39 111 41 106 C43 89 44 70 43 54 Z', 'M43 55 C48 76 53 95 59 105 C62 109 65 106 64 101 C62 82 56 64 52 51 Z'],
    crownDetails: ['M12 27 C18 20 25 21 31 27 C36 20 44 20 50 26 C54 23 58 25 59 29', 'M13 42 C25 48 47 49 56 41', 'M31 27 C31 34 32 39 35 45'],
    rootDetails: ['M23 58 C19 75 14 92 12 103', 'M37 59 L37 103', 'M49 58 C54 76 57 91 60 102']
  },
  PERMANENT_MAXILLARY_7: {
    crown: 'M8 20 C9 14 14 11 20 12 C25 8 31 9 36 13 C42 9 49 10 55 14 C60 18 62 25 61 32 L59 44 C56 52 48 56 36 57 C24 58 13 54 10 46 C8 39 7 27 8 20 Z',
    roots: ['M22 52 C17 68 13 88 12 102 C12 108 15 110 19 106 C26 94 29 75 32 54 Z', 'M39 54 C43 73 48 93 53 104 C55 109 59 108 60 102 C59 83 54 65 50 52 Z'],
    crownDetails: ['M13 28 C20 21 27 22 33 28 C39 21 48 21 56 28', 'M14 43 C26 48 47 49 56 42', 'M33 28 C33 34 34 40 36 45'],
    rootDetails: ['M25 58 C21 75 17 91 16 103', 'M46 58 C50 75 54 91 56 102']
  },
  PERMANENT_MAXILLARY_8: {
    crown: 'M10 21 C11 15 16 12 22 13 C27 9 33 10 38 14 C43 11 50 12 55 16 C59 21 61 27 59 34 L57 45 C54 52 47 56 36 57 C25 58 16 54 12 47 C10 40 9 28 10 21 Z',
    roots: ['M23 53 C18 69 16 86 17 100 C18 106 22 108 26 103 C31 94 34 82 36 72 C38 84 42 98 47 104 C51 108 55 105 55 100 C54 83 49 67 46 53 C39 49 30 49 23 53 Z'],
    crownDetails: ['M15 29 C22 23 28 23 34 29 C40 23 48 23 55 29', 'M16 43 C26 48 45 49 54 42'],
    rootDetails: ['M29 58 C28 74 25 89 22 100', 'M43 58 C46 74 49 88 51 100']
  },

  PERMANENT_MANDIBULAR_1: {
    crown: 'M23 9 C23 6 27 5 31 6 C35 7 40 5 44 7 C48 9 49 13 48 18 L47 39 C46 48 42 53 36 55 C29 55 25 51 24 43 C23 34 23 20 23 9 Z',
    roots: ['M29 52 C29 68 31 88 33 104 C34 110 37 111 40 106 C43 88 44 69 43 52 C39 49 33 49 29 52 Z'],
    crownDetails: ['M28 14 C33 12 40 12 45 14', 'M28 41 C32 45 40 46 44 41'],
    rootDetails: ['M35 57 C35 73 36 90 36 102']
  },
  PERMANENT_MANDIBULAR_2: {
    crown: 'M21 9 C21 6 25 4 30 5 C35 6 41 5 46 7 C50 9 51 13 50 19 L49 40 C48 48 43 54 36 55 C28 56 23 51 22 43 C21 34 21 20 21 9 Z',
    roots: ['M28 52 C28 69 30 88 33 104 C34 110 37 111 40 106 C44 88 45 68 44 52 C39 49 33 49 28 52 Z'],
    crownDetails: ['M26 14 C32 11 42 11 47 14', 'M26 41 C31 46 42 47 47 41'],
    rootDetails: ['M34 57 C35 75 35 90 36 102']
  },
  PERMANENT_MANDIBULAR_3: {
    crown: 'M35 5 C38 4 40 9 43 15 C47 23 51 32 51 40 C51 48 46 54 38 56 C30 58 22 53 21 45 C21 37 25 30 29 22 C32 16 32 7 35 5 Z',
    roots: ['M28 53 C28 69 30 87 33 104 C34 111 37 112 40 106 C44 87 46 68 45 52 C39 48 33 49 28 53 Z'],
    crownDetails: ['M25 42 C30 48 42 49 47 42'],
    rootDetails: ['M34 58 C35 75 35 91 36 102']
  },
  PERMANENT_MANDIBULAR_4: {
    crown: 'M15 17 C17 11 23 9 29 13 C34 9 40 10 46 14 C51 17 54 23 53 30 L51 43 C48 51 42 55 34 56 C25 57 18 52 16 44 C14 36 13 25 15 17 Z',
    roots: ['M27 52 C27 69 29 87 32 104 C33 110 37 112 40 107 C45 88 47 68 45 52 C40 49 33 49 27 52 Z'],
    crownDetails: ['M19 26 C25 21 30 23 34 28 C40 23 47 23 50 27', 'M20 42 C28 47 41 48 48 41'],
    rootDetails: ['M34 57 C35 74 35 90 36 102']
  },
  PERMANENT_MANDIBULAR_5: {
    crown: 'M13 18 C15 12 21 10 28 13 C33 9 40 10 47 14 C52 18 55 24 54 31 L52 44 C49 52 43 56 34 57 C24 57 17 52 15 44 C13 36 12 25 13 18 Z',
    roots: ['M27 53 C27 69 29 87 32 104 C33 111 37 112 40 107 C45 88 47 68 45 53 C40 49 33 49 27 53 Z'],
    crownDetails: ['M18 27 C24 21 30 23 35 29 C41 23 48 23 51 28', 'M19 43 C27 48 42 49 49 42'],
    rootDetails: ['M34 58 C35 74 35 90 36 102']
  },
  PERMANENT_MANDIBULAR_6: {
    crown: 'M6 18 C7 12 13 9 20 11 C25 7 31 8 36 12 C42 8 49 9 55 13 C61 17 64 24 63 31 L61 44 C58 52 49 57 36 58 C22 59 11 55 8 47 C6 39 5 26 6 18 Z',
    roots: ['M21 53 C17 68 12 87 11 102 C11 109 15 111 19 106 C26 95 30 76 32 55 Z', 'M40 54 C44 74 49 94 55 105 C58 110 62 108 62 102 C61 83 55 65 51 52 Z'],
    crownDetails: ['M11 27 C17 20 24 21 30 27 C36 20 43 21 49 27 C54 22 59 25 61 29', 'M12 43 C25 49 48 50 58 42', 'M31 27 C32 34 33 40 36 46'],
    rootDetails: ['M25 59 C21 76 16 92 15 103', 'M47 59 C51 76 56 92 58 102']
  },
  PERMANENT_MANDIBULAR_7: {
    crown: 'M8 19 C9 13 14 10 21 12 C26 8 32 9 37 13 C43 9 50 10 56 14 C61 18 63 25 62 32 L60 45 C57 53 49 57 36 58 C23 59 13 55 10 47 C8 39 7 27 8 19 Z',
    roots: ['M22 53 C18 68 14 87 14 102 C14 108 18 110 22 105 C28 94 31 75 33 55 Z', 'M40 55 C44 74 49 93 54 104 C57 109 61 107 61 101 C60 82 55 65 51 53 Z'],
    crownDetails: ['M13 28 C20 21 27 22 33 28 C39 21 48 21 57 28', 'M14 44 C26 49 48 50 57 43', 'M34 28 C34 35 35 41 37 46'],
    rootDetails: ['M26 59 C22 76 18 92 18 102', 'M47 59 C51 76 56 91 57 101']
  },
  PERMANENT_MANDIBULAR_8: {
    crown: 'M10 21 C11 15 16 12 22 13 C27 9 33 10 38 14 C44 10 51 12 56 16 C60 21 62 27 60 34 L58 46 C55 53 47 57 36 58 C25 59 16 55 12 48 C10 41 9 28 10 21 Z',
    roots: ['M23 54 C19 70 17 86 18 100 C19 106 23 108 27 103 C32 94 34 82 36 72 C39 85 43 98 48 104 C52 108 56 105 56 100 C55 82 50 66 47 54 C40 50 30 50 23 54 Z'],
    crownDetails: ['M15 29 C22 23 29 23 35 29 C41 23 49 23 56 29', 'M16 44 C27 49 46 50 55 43'],
    rootDetails: ['M29 59 C28 75 25 89 23 99', 'M44 59 C47 75 50 89 52 100']
  },

  PRIMARY_MAXILLARY_1: {
    crown: 'M17 13 C17 8 21 6 27 7 C33 8 40 7 46 8 C51 9 55 13 54 19 L52 42 C50 51 44 56 36 57 C27 57 20 52 19 44 C18 35 17 23 17 13 Z',
    roots: ['M28 53 C29 71 31 88 33 101 C34 107 37 108 40 102 C43 86 45 69 44 53 C39 49 33 49 28 53 Z'],
    crownDetails: ['M23 19 C30 16 42 16 49 19']
  },
  PRIMARY_MAXILLARY_2: {
    crown: 'M21 14 C21 10 25 8 30 9 C35 10 40 8 45 10 C49 12 51 16 50 21 L49 42 C47 50 43 54 36 56 C29 56 24 52 23 44 C22 35 21 23 21 14 Z',
    roots: ['M29 53 C30 70 31 86 33 100 C34 106 37 107 39 102 C42 86 44 68 43 53 C39 50 33 50 29 53 Z'],
    crownDetails: ['M26 20 C31 17 41 17 47 20']
  },
  PRIMARY_MAXILLARY_3: {
    crown: 'M35 8 C38 7 40 12 43 18 C47 26 50 34 50 41 C50 49 45 54 38 56 C30 57 23 53 22 46 C21 39 25 32 29 24 C32 18 32 10 35 8 Z',
    roots: ['M29 53 C29 69 31 87 33 102 C34 108 37 109 40 103 C43 86 45 68 44 53 C39 49 34 49 29 53 Z'],
    crownDetails: ['M26 43 C31 48 41 49 46 42']
  },
  PRIMARY_MAXILLARY_4: {
    crown: 'M12 20 C13 14 19 11 25 13 C30 9 36 10 41 14 C47 11 54 15 57 21 C60 27 59 36 57 43 C54 51 47 56 36 57 C24 58 15 54 12 46 C10 39 10 27 12 20 Z',
    roots: ['M21 53 C15 67 10 84 8 100 C8 106 11 109 15 105 C23 95 28 75 31 55 Z', 'M32 54 C33 71 34 89 36 103 C37 108 40 108 41 102 C43 86 44 70 43 54 Z', 'M44 55 C49 74 55 92 61 101 C64 105 67 102 65 97 C62 80 56 64 52 52 Z'],
    crownDetails: ['M17 29 C23 22 29 23 34 29 C40 22 48 22 54 29', 'M16 43 C27 49 46 49 55 42']
  },
  PRIMARY_MAXILLARY_5: {
    crown: 'M8 20 C9 14 14 11 21 12 C26 8 32 9 37 13 C43 9 51 10 57 15 C62 19 64 26 62 34 L60 45 C57 53 49 57 36 58 C23 59 13 55 10 47 C8 39 7 27 8 20 Z',
    roots: ['M20 53 C14 68 9 85 7 101 C6 108 10 110 14 106 C22 95 27 75 31 55 Z', 'M32 54 C33 72 34 91 36 105 C37 110 40 110 42 104 C44 87 45 70 44 54 Z', 'M45 55 C50 75 56 94 62 103 C65 107 68 104 66 99 C63 81 57 64 53 52 Z'],
    crownDetails: ['M13 29 C20 22 27 22 33 28 C39 21 48 21 58 29', 'M14 44 C26 49 48 50 58 43']
  },
  PRIMARY_MANDIBULAR_1: {
    crown: 'M24 12 C24 8 27 7 31 8 C35 9 39 7 43 9 C46 11 47 14 46 19 L45 40 C44 48 41 52 36 54 C30 54 27 50 26 43 C25 34 24 22 24 12 Z',
    roots: ['M30 51 C30 67 32 85 34 100 C35 106 37 106 39 101 C42 85 43 67 42 51 C38 49 33 49 30 51 Z'],
    crownDetails: ['M28 17 C33 15 39 15 43 17']
  },
  PRIMARY_MANDIBULAR_2: {
    crown: 'M22 12 C22 8 26 6 30 7 C35 8 40 7 44 9 C48 11 49 15 48 20 L47 40 C46 48 42 53 36 55 C29 55 25 51 24 43 C23 34 22 22 22 12 Z',
    roots: ['M29 52 C29 68 31 86 33 101 C34 107 37 108 40 102 C43 85 44 67 43 52 C39 49 33 49 29 52 Z'],
    crownDetails: ['M27 17 C32 14 41 14 46 17']
  },
  PRIMARY_MANDIBULAR_3: {
    crown: 'M35 8 C38 7 40 12 43 18 C47 26 50 34 50 41 C50 49 45 54 38 56 C30 57 23 53 22 46 C21 39 25 32 29 24 C32 18 32 10 35 8 Z',
    roots: ['M29 53 C29 69 31 87 33 102 C34 108 37 109 40 103 C43 86 45 68 44 53 C39 49 34 49 29 53 Z'],
    crownDetails: ['M26 43 C31 48 41 49 46 42']
  },
  PRIMARY_MANDIBULAR_4: {
    crown: 'M11 20 C12 14 18 11 25 13 C30 9 36 10 41 14 C47 11 54 15 57 21 C60 27 59 36 57 43 C54 51 47 56 36 57 C24 58 15 54 12 46 C10 39 9 27 11 20 Z',
    roots: ['M21 53 C16 68 12 86 11 101 C11 107 15 109 19 104 C26 93 29 75 32 55 Z', 'M41 55 C45 74 50 93 56 103 C59 108 63 106 62 100 C60 82 55 65 51 53 Z'],
    crownDetails: ['M16 29 C23 22 29 23 35 29 C41 22 49 23 55 29', 'M15 43 C27 49 47 50 56 42']
  },
  PRIMARY_MANDIBULAR_5: {
    crown: 'M8 20 C9 14 14 11 21 12 C26 8 32 9 37 13 C43 9 51 10 57 15 C62 19 64 26 62 34 L60 45 C57 53 49 57 36 58 C23 59 13 55 10 47 C8 39 7 27 8 20 Z',
    roots: ['M20 53 C15 68 11 86 10 102 C10 108 14 110 18 105 C25 94 29 75 32 55 Z', 'M41 55 C45 75 51 94 57 104 C60 109 64 106 63 100 C61 82 56 65 52 53 Z'],
    crownDetails: ['M13 29 C20 22 27 22 33 28 C39 21 48 21 58 29', 'M14 44 C26 49 48 50 58 43']
  }
}

@Component({
  selector: 'app-odontogram-tooth',
  standalone: true,
  template: `
    <svg [class]="'odontogram-tooth tooth-' + status.toLowerCase()" viewBox="0 0 72 112" aria-hidden="true">
      <defs>
        <linearGradient [attr.id]="rootGradientId" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#f2c98f" />
          <stop offset="0.48" stop-color="#ffe3b4" />
          <stop offset="1" stop-color="#edbf80" />
        </linearGradient>
        <linearGradient [attr.id]="crownGradientId" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="0.7" stop-color="#fbfdfd" />
          <stop offset="1" stop-color="#eaf5f2" />
        </linearGradient>
      </defs>
      <g [attr.transform]="shapeTransform">
        @for (root of shape.roots; track root) {
          <path class="tooth-part tooth-root" [attr.d]="root" [attr.fill]="'url(#' + rootGradientId + ')'" />
        }
        @for (detail of shape.rootDetails || []; track detail) {
          <path class="root-detail" [attr.d]="detail" />
        }
        <path class="tooth-part tooth-crown" [attr.d]="shape.crown" [attr.fill]="'url(#' + crownGradientId + ')'" />
        <path class="clinical-accent" [attr.d]="shape.crown" />
        @for (detail of shape.crownDetails || []; track detail) {
          <path class="crown-detail" [attr.d]="detail" />
        }
        <path class="enamel-highlight" d="M24 17 C22 26 23 35 26 40" />
      </g>
    </svg>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 82px; }
    .odontogram-tooth { width: 100%; height: 100%; overflow: visible; --clinical-color: transparent; filter: drop-shadow(0 1px 1px rgb(80 69 51 / .10)); }
    .tooth-part { stroke: #6f706c; stroke-width: 1.65; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
    .tooth-root { fill: #f7d6a4; }
    .tooth-crown { fill: #fff; }
    .crown-detail { fill: none; stroke: #a8b2ad; stroke-width: 1.15; stroke-linecap: round; opacity: .62; vector-effect: non-scaling-stroke; }
    .root-detail { fill: none; stroke: #d5a66e; stroke-width: 1; stroke-linecap: round; opacity: .46; vector-effect: non-scaling-stroke; }
    .enamel-highlight { fill: none; stroke: #dceee9; stroke-width: 2.2; stroke-linecap: round; opacity: .8; vector-effect: non-scaling-stroke; }
    .clinical-accent { fill: var(--clinical-fill, transparent); stroke: var(--clinical-color); stroke-width: 2.3; stroke-linecap: round; stroke-linejoin: round; opacity: .9; vector-effect: non-scaling-stroke; }
    .tooth-caries, .tooth-extraction { --clinical-color: #ef4444; --clinical-fill: rgb(254 226 226 / .20); }
    .tooth-restoration, .tooth-crown, .tooth-implant { --clinical-color: #2563eb; --clinical-fill: rgb(219 234 254 / .34); }
    .tooth-endo { --clinical-color: #8b5cf6; --clinical-fill: rgb(237 233 254 / .30); }
    .tooth-missing { opacity: .30; }
    .tooth-watch { --clinical-color: #f59e0b; --clinical-fill: rgb(254 243 199 / .34); }
  `]
})
export class OdontogramToothComponent {
  @Input({ required: true }) tooth = '11'
  @Input() status = 'HEALTHY'

  get shape(): ToothShape {
    return TOOTH_SHAPES[this.shapeKey] || TOOTH_SHAPES['PERMANENT_MAXILLARY_1']
  }

  get rootGradientId() { return `tooth-root-${this.tooth}` }
  get crownGradientId() { return `tooth-crown-${this.tooth}` }

  get shapeTransform() {
    const scaleX = this.isLeft ? -1 : 1
    const scaleY = this.isUpper ? -1 : 1
    return `matrix(${scaleX} 0 0 ${scaleY} ${scaleX === -1 ? 72 : 0} ${scaleY === -1 ? 112 : 0})`
  }

  private get shapeKey() {
    const quadrant = Number(this.tooth[0])
    const position = Number(this.tooth[1])
    const generation = quadrant >= 5 ? 'PRIMARY' : 'PERMANENT'
    const arch = this.isUpper ? 'MAXILLARY' : 'MANDIBULAR'
    return `${generation}_${arch}_${position}`
  }

  private get isUpper() {
    return ['1', '2', '5', '6'].includes(this.tooth[0])
  }

  private get isLeft() {
    return ['2', '3', '6', '7'].includes(this.tooth[0])
  }
}
