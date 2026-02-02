// widget/widget-plugin-config.component.ts
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-widget-plugin-config',
  template: `
    <div class="form-group">
      <label>Widget Configuration</label>
      <p>Add your configuration options here</p>
    </div>
  `
})
export class WidgetPluginConfigComponent {
  @Input() config: any = {};
  
  constructor() {}
}