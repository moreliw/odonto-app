import { Component, Input } from '@angular/core'

type ToothShape = {
  crown: string
  roots: string[]
  details: string[]
}

const TOOTH_SHAPES: Record<string, ToothShape> = {
  PERMANENT_MAXILLARY_1: {
    crown: 'M18 12 Q19 7 25 6 L40 6 Q46 8 47 14 L46 35 Q45 43 39 46 L25 46 Q18 43 17 35 Z',
    roots: ['M24 43 Q25 59 28 82 Q29 91 32 93 Q36 90 37 82 Q40 60 40 43 Z'],
    details: ['M23 15 Q32 11 42 15', 'M23 35 Q32 39 42 35']
  },
  PERMANENT_MAXILLARY_2: {
    crown: 'M20 14 Q21 9 26 8 L38 8 Q43 10 44 15 L43 36 Q42 43 37 46 L26 46 Q20 42 19 35 Z',
    roots: ['M26 43 Q27 62 29 84 Q30 91 33 93 Q36 89 37 82 Q39 62 38 43 Z'],
    details: ['M24 17 Q32 13 40 17', 'M24 35 Q32 39 40 35']
  },
  PERMANENT_MAXILLARY_3: {
    crown: 'M16 35 Q19 25 29 12 Q32 7 35 12 Q44 25 48 35 Q47 42 40 46 L25 46 Q18 43 16 35 Z',
    roots: ['M25 44 Q25 62 28 84 Q29 94 33 96 Q37 92 39 82 Q41 61 39 44 Z'],
    details: ['M21 35 L32 17 L43 35', 'M24 38 Q32 42 41 38']
  },
  PERMANENT_MAXILLARY_4: {
    crown: 'M13 30 Q16 19 25 14 Q31 9 36 14 Q46 18 51 30 L48 41 Q44 47 33 47 Q21 47 16 41 Z',
    roots: ['M21 43 Q18 60 18 84 Q19 92 23 92 Q27 88 29 61 L30 44 Z', 'M34 44 Q36 61 39 86 Q41 92 45 89 Q48 84 45 61 Q43 49 42 43 Z'],
    details: ['M17 30 Q24 24 31 16 Q38 24 47 30', 'M20 38 Q31 42 45 38']
  },
  PERMANENT_MAXILLARY_5: {
    crown: 'M13 30 Q16 20 25 15 Q31 11 37 15 Q47 20 51 30 L48 41 Q43 47 32 47 Q21 47 16 41 Z',
    roots: ['M24 44 Q24 61 27 84 Q29 92 33 93 Q37 89 39 82 Q41 61 40 44 Z'],
    details: ['M17 30 Q24 25 31 17 Q39 25 47 30', 'M20 38 Q31 42 45 38']
  },
  PERMANENT_MAXILLARY_6: {
    crown: 'M8 26 Q12 16 22 14 Q31 9 42 14 Q52 16 56 27 L53 41 Q48 48 32 48 Q16 48 10 41 Z',
    roots: ['M17 44 Q13 61 11 82 Q11 90 15 91 Q20 89 24 79 L29 45 Z', 'M29 45 Q30 66 31 91 Q33 96 36 91 Q39 67 38 45 Z', 'M39 45 L45 80 Q48 91 53 88 Q55 83 50 61 Q47 50 46 43 Z'],
    details: ['M13 28 Q20 19 30 24 Q38 16 51 27', 'M19 20 L23 40', 'M43 19 L39 40', 'M14 39 Q31 44 50 39']
  },
  PERMANENT_MAXILLARY_7: {
    crown: 'M9 27 Q12 18 22 15 Q32 11 42 15 Q51 18 55 27 L52 41 Q47 47 32 48 Q17 48 11 41 Z',
    roots: ['M18 44 Q14 62 14 83 Q15 90 19 91 Q24 88 27 78 L30 45 Z', 'M35 45 Q38 62 40 84 Q42 91 47 88 Q50 83 47 64 Q45 52 44 43 Z'],
    details: ['M14 28 Q22 20 31 25 Q40 19 50 28', 'M18 39 Q31 43 48 39']
  },
  PERMANENT_MAXILLARY_8: {
    crown: 'M11 29 Q14 20 23 17 Q32 12 42 17 Q50 20 53 30 L50 41 Q45 47 33 47 Q19 47 13 41 Z',
    roots: ['M21 44 Q18 61 20 79 Q22 88 27 88 Q31 85 32 72 Q34 86 39 89 Q44 88 45 80 Q45 62 41 44 Z'],
    details: ['M16 29 Q23 22 31 27 Q39 20 48 29', 'M18 39 Q32 43 47 39']
  },
  PERMANENT_MANDIBULAR_1: {
    crown: 'M22 15 Q23 11 27 10 L37 10 Q41 11 42 15 L42 36 Q41 43 36 46 L28 46 Q23 43 22 36 Z',
    roots: ['M27 43 Q28 63 29 85 Q30 92 32 94 Q35 91 36 84 Q38 63 37 43 Z'],
    details: ['M25 18 Q32 15 39 18', 'M26 36 Q32 39 39 36']
  },
  PERMANENT_MANDIBULAR_2: {
    crown: 'M20 14 Q21 10 26 9 L38 9 Q43 11 44 15 L44 36 Q42 43 37 46 L27 46 Q21 43 20 36 Z',
    roots: ['M26 43 Q27 63 29 85 Q30 93 33 94 Q36 90 37 84 Q39 63 38 43 Z'],
    details: ['M24 17 Q32 14 40 17', 'M24 36 Q32 40 40 36']
  },
  PERMANENT_MANDIBULAR_3: {
    crown: 'M17 35 Q20 25 29 14 Q32 9 35 14 Q43 25 47 35 Q46 42 40 46 L25 46 Q19 43 17 35 Z',
    roots: ['M25 44 Q26 64 28 85 Q29 93 33 95 Q37 91 39 82 Q40 63 39 44 Z'],
    details: ['M22 35 L32 19 L42 35', 'M24 39 Q32 42 41 39']
  },
  PERMANENT_MANDIBULAR_4: {
    crown: 'M14 31 Q17 21 27 15 Q31 12 36 16 Q46 22 50 31 L47 41 Q42 47 32 47 Q21 47 16 41 Z',
    roots: ['M25 44 Q25 63 28 85 Q29 92 33 94 Q37 90 39 82 Q41 62 39 44 Z'],
    details: ['M18 31 Q25 24 31 18 Q38 27 46 31', 'M20 39 Q32 43 45 39']
  },
  PERMANENT_MANDIBULAR_5: {
    crown: 'M12 30 Q15 20 25 15 Q31 11 38 15 Q48 20 52 30 L49 41 Q44 47 32 48 Q20 47 15 41 Z',
    roots: ['M24 44 Q24 62 27 84 Q29 92 33 94 Q37 90 39 82 Q41 62 40 44 Z'],
    details: ['M16 30 Q23 24 31 17 Q39 24 48 30', 'M19 39 Q31 43 47 39']
  },
  PERMANENT_MANDIBULAR_6: {
    crown: 'M7 27 Q10 18 20 15 Q31 10 43 14 Q54 17 58 27 L54 41 Q49 48 32 49 Q15 48 9 41 Z',
    roots: ['M18 44 Q14 62 14 84 Q15 92 20 92 Q25 89 28 78 L31 45 Z', 'M36 45 L41 82 Q43 92 48 90 Q52 86 49 66 Q47 53 45 43 Z'],
    details: ['M12 28 Q19 20 27 25 Q34 18 41 24 Q49 20 54 29', 'M18 19 L22 41', 'M45 18 L42 41', 'M13 39 Q31 44 52 39']
  },
  PERMANENT_MANDIBULAR_7: {
    crown: 'M9 28 Q12 19 22 15 Q32 11 43 15 Q52 19 55 28 L52 41 Q47 48 32 48 Q17 48 11 41 Z',
    roots: ['M19 44 Q15 63 16 83 Q17 91 21 91 Q26 88 29 78 L31 45 Z', 'M36 45 Q39 63 42 84 Q44 91 48 88 Q51 83 48 64 Q46 52 45 43 Z'],
    details: ['M14 28 Q22 20 31 25 Q40 20 50 28', 'M19 19 L22 40', 'M44 19 L41 40', 'M15 39 Q31 43 50 39']
  },
  PERMANENT_MANDIBULAR_8: {
    crown: 'M11 29 Q14 20 23 17 Q32 13 42 17 Q50 20 53 30 L50 41 Q45 47 33 47 Q19 47 13 41 Z',
    roots: ['M21 44 Q18 62 20 80 Q22 89 27 88 Q31 84 32 72 Q34 86 39 89 Q44 88 45 80 Q45 62 41 44 Z'],
    details: ['M16 29 Q23 22 31 27 Q39 21 48 29', 'M18 39 Q32 43 47 39']
  },
  PRIMARY_MAXILLARY_1: {
    crown: 'M18 17 Q19 11 25 10 L40 10 Q46 12 47 18 L46 37 Q44 44 38 47 L26 47 Q19 44 18 37 Z',
    roots: ['M26 44 Q27 61 29 80 Q30 88 33 90 Q36 86 38 79 Q40 60 39 44 Z'],
    details: ['M23 20 Q32 16 42 20', 'M23 37 Q32 41 42 37']
  },
  PRIMARY_MAXILLARY_2: {
    crown: 'M21 18 Q22 13 27 12 L38 12 Q43 14 44 19 L43 37 Q42 44 37 47 L28 47 Q22 44 21 37 Z',
    roots: ['M28 44 Q29 62 30 80 Q31 87 33 89 Q36 85 37 79 Q39 61 37 44 Z'],
    details: ['M25 21 Q32 18 40 21', 'M25 37 Q32 41 40 37']
  },
  PRIMARY_MAXILLARY_3: {
    crown: 'M18 37 Q21 28 29 18 Q32 13 35 18 Q43 28 47 37 Q45 44 39 47 L26 47 Q20 44 18 37 Z',
    roots: ['M26 45 Q27 62 29 82 Q30 91 33 93 Q37 89 39 80 Q40 61 38 45 Z'],
    details: ['M23 37 L32 22 L42 37', 'M25 40 Q32 43 40 40']
  },
  PRIMARY_MAXILLARY_4: {
    crown: 'M12 31 Q15 21 24 17 Q32 12 40 17 Q49 21 52 31 L49 42 Q44 49 32 49 Q19 49 14 42 Z',
    roots: ['M20 45 Q14 60 12 82 Q12 90 17 90 Q22 87 26 77 L29 46 Z', 'M29 46 Q31 65 32 89 Q34 94 37 89 Q39 66 38 46 Z', 'M39 46 L45 80 Q48 90 52 87 Q54 82 49 62 Q46 51 45 44 Z'],
    details: ['M16 31 Q23 23 31 27 Q39 21 48 31', 'M18 41 Q31 45 47 41']
  },
  PRIMARY_MAXILLARY_5: {
    crown: 'M9 29 Q12 19 22 16 Q32 11 43 16 Q52 19 55 29 L52 42 Q47 49 32 49 Q17 49 11 42 Z',
    roots: ['M18 45 Q12 62 10 83 Q10 91 15 92 Q21 89 25 78 L29 46 Z', 'M29 46 Q30 67 32 91 Q34 96 37 91 Q39 67 38 46 Z', 'M40 46 L46 81 Q49 92 54 89 Q56 83 51 62 Q48 50 46 44 Z'],
    details: ['M14 29 Q22 21 31 26 Q40 20 50 29', 'M18 21 L22 42', 'M45 21 L41 42', 'M14 41 Q32 46 50 41']
  },
  PRIMARY_MANDIBULAR_1: {
    crown: 'M23 18 Q24 14 28 13 L36 13 Q40 14 41 18 L41 37 Q40 44 36 47 L29 47 Q24 44 23 37 Z',
    roots: ['M28 44 Q29 63 30 82 Q31 89 33 91 Q35 87 36 81 Q38 62 36 44 Z'],
    details: ['M26 21 Q32 18 38 21', 'M27 37 Q32 40 38 37']
  },
  PRIMARY_MANDIBULAR_2: {
    crown: 'M21 17 Q22 13 27 12 L38 12 Q42 14 43 18 L43 37 Q42 44 37 47 L28 47 Q22 44 21 37 Z',
    roots: ['M27 44 Q28 63 30 82 Q31 90 33 91 Q36 87 37 80 Q39 62 37 44 Z'],
    details: ['M25 20 Q32 17 40 20', 'M25 37 Q32 41 40 37']
  },
  PRIMARY_MANDIBULAR_3: {
    crown: 'M18 37 Q21 28 29 18 Q32 13 35 18 Q43 28 47 37 Q45 44 39 47 L26 47 Q20 44 18 37 Z',
    roots: ['M26 45 Q27 64 29 83 Q30 91 33 93 Q37 89 39 80 Q40 63 38 45 Z'],
    details: ['M23 37 L32 22 L42 37', 'M25 40 Q32 43 40 40']
  },
  PRIMARY_MANDIBULAR_4: {
    crown: 'M11 31 Q14 21 24 17 Q32 13 41 17 Q50 21 53 31 L50 42 Q45 49 32 49 Q18 49 13 42 Z',
    roots: ['M20 45 Q15 62 14 83 Q15 91 20 91 Q25 88 29 77 L31 46 Z', 'M35 46 Q39 62 42 83 Q44 91 49 88 Q52 83 48 63 Q46 51 45 44 Z'],
    details: ['M16 31 Q23 23 31 27 Q39 22 48 31', 'M18 41 Q31 45 48 41']
  },
  PRIMARY_MANDIBULAR_5: {
    crown: 'M8 29 Q11 19 21 16 Q32 11 44 16 Q54 19 57 29 L53 42 Q48 49 32 49 Q15 49 10 42 Z',
    roots: ['M18 45 Q12 63 12 84 Q13 92 18 92 Q24 89 28 78 L31 46 Z', 'M36 46 Q40 63 44 84 Q46 92 51 89 Q54 84 50 63 Q47 51 46 44 Z'],
    details: ['M13 29 Q20 21 28 26 Q35 19 43 25 Q50 21 53 30', 'M18 20 L22 42', 'M46 20 L42 42', 'M14 41 Q32 46 51 41']
  }
}

@Component({
  selector: 'app-odontogram-tooth',
  standalone: true,
  template: `
    <svg [class]="'odontogram-tooth tooth-' + status.toLowerCase()" viewBox="0 0 64 96" aria-hidden="true">
      <g [attr.transform]="shapeTransform">
        @for (root of shape.roots; track root) {
          <path class="tooth-part tooth-root" [attr.d]="root" />
        }
        <path class="tooth-part tooth-crown" [attr.d]="shape.crown" />
        @for (detail of shape.details; track detail) {
          <path class="tooth-detail" [attr.d]="detail" />
        }
      </g>
    </svg>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 68px; }
    .odontogram-tooth { width: 100%; height: 100%; overflow: visible; color: #94a3b8; filter: drop-shadow(0 1px 0 rgb(255 255 255 / .8)); }
    .tooth-part { fill: var(--tooth-fill, #fff); stroke: var(--tooth-stroke, currentColor); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
    .tooth-root { fill: color-mix(in srgb, var(--tooth-fill, #fff) 88%, #fff); }
    .tooth-detail { fill: none; stroke: var(--tooth-stroke, currentColor); stroke-width: 1.2; stroke-linecap: round; opacity: .48; vector-effect: non-scaling-stroke; }
    .tooth-caries, .tooth-extraction { --tooth-fill: #fee2e2; --tooth-stroke: #ef4444; }
    .tooth-restoration, .tooth-crown, .tooth-implant { --tooth-fill: #dbeafe; --tooth-stroke: #2563eb; }
    .tooth-endo { --tooth-fill: #ede9fe; --tooth-stroke: #8b5cf6; }
    .tooth-missing { --tooth-fill: #f8fafc; --tooth-stroke: #94a3b8; opacity: .32; }
    .tooth-watch { --tooth-fill: #fef3c7; --tooth-stroke: #f59e0b; }
  `]
})
export class OdontogramToothComponent {
  @Input({ required: true }) tooth = '11'
  @Input() status = 'HEALTHY'

  get shape(): ToothShape {
    return TOOTH_SHAPES[this.shapeKey] || TOOTH_SHAPES['PERMANENT_MAXILLARY_1']
  }

  get shapeTransform() {
    const scaleX = this.isLeft ? -1 : 1
    const scaleY = this.isUpper ? -1 : 1
    return `matrix(${scaleX} 0 0 ${scaleY} ${scaleX === -1 ? 64 : 0} ${scaleY === -1 ? 96 : 0})`
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
