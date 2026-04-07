import { Component, EventEmitter, Input, Output } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-filter-bar",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card filter-bar">
      <input
        class="input"
        [value]="search"
        (input)="onSearchChange($event)"
        placeholder="Buscar paciente, procedimento ou dentista"
      />
      <select class="select" [value]="status" (change)="onStatusChange($event)">
        <option value="ALL">Todos</option>
        <option value="PAGO">Pago</option>
        <option value="PENDENTE">Pendente</option>
        <option value="ATRASADO">Atrasado</option>
      </select>
      <select
        class="select"
        [value]="pageSize.toString()"
        (change)="onPageSizeChange($event)"
      >
        <option value="6">6 por página</option>
        <option value="10">10 por página</option>
        <option value="20">20 por página</option>
      </select>
    </div>
  `,
})
export class FilterBarComponent {
  @Input() search = "";
  @Input() status: "ALL" | "PAGO" | "PENDENTE" | "ATRASADO" = "ALL";
  @Input() pageSize = 6;

  @Output() searchChange = new EventEmitter<string>();
  @Output() statusChange = new EventEmitter<
    "ALL" | "PAGO" | "PENDENTE" | "ATRASADO"
  >();
  @Output() pageSizeChange = new EventEmitter<number>();

  onSearchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchChange.emit(value);
  }

  onStatusChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as
      | "ALL"
      | "PAGO"
      | "PENDENTE"
      | "ATRASADO";
    this.statusChange.emit(value);
  }

  onPageSizeChange(event: Event) {
    const value = Number((event.target as HTMLSelectElement).value);
    this.pageSizeChange.emit(value);
  }
}
