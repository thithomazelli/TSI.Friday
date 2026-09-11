import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { HeaderComponent } from '../shared/header/header.component';
import { EventListComponent } from '../shared/components/event-list/event-list.component';
import { TranslatePipe } from '../core/pipes/translate.pipe';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
    selector: 'app-agenda',
    templateUrl: './agenda.component.html',
    styleUrl: './agenda.component.scss',
    imports: [HeaderComponent, EventListComponent, TranslatePipe],
})
export class AgendaComponent implements OnInit {
  onlyMine = false;

  constructor(private activatedRoute: ActivatedRoute) {}

  ngOnInit(): void {
    this.onlyMine = this.activatedRoute.snapshot.queryParamMap.get('onlyMine') === 'true';
  }
}
