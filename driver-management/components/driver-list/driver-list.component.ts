import { Component, OnInit, Pipe, PipeTransform, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { DriverService } from '../../services/driver.service';
import { Driver, DriverGroup } from '../../models/driver.model';
import { AlertService } from '@c8y/ngx-components';

@Pipe({ name: 'filter', pure: false })
export class FilterPipe implements PipeTransform {
  transform(items: any[], field: string, value: any): any[] {
    if (!items || !field) return items;
    return items.filter(item => item[field] === value);
  }
}

@Component({
  selector: 'app-driver-list',
  templateUrl: './driver-list.component.html'
})
export class DriverListComponent implements OnInit {

  // ── Tabs ─────────────────────────────────────────────────────
  activeTab: 'drivers' | 'groups' = 'drivers';

  // ── Driver list table (infinite scroll) ──────────────────────
  drivers: Driver[] = [];
  filteredDrivers: Driver[] = [];
  loading = false;
  loadingMoreTable = false;
  tableHasMore = false;
  tablePage = 1;
  searchTerm = '';
  Object = Object;

  // ── Groups ───────────────────────────────────────────────────
  groups: DriverGroup[] = [];
  filteredGroups: DriverGroup[] = [];
  loadingGroups = false;
  groupSearchTerm = '';

  // ── Modals ───────────────────────────────────────────────────
  showGroupModal = false;
  showAssignDriverModal = false;
  editingGroup: DriverGroup | null = null;
  selectedGroup: DriverGroup | null = null;

  groupForm = { name: '', description: '' };

  // ── Assign modal: target group ────────────────────────────────
  assignGroupId = '';

  // ── Searchable GROUP dropdown ─────────────────────────────────
  groupDropdownOpen   = false;
  groupSelectSearch   = '';
  filteredGroupOptions: DriverGroup[] = [];

  // ── Multi-select DRIVER panel (scroll-to-load + checkboxes) ──
  showDriverPanel      = false;
  driverPanelSearch    = '';
  panelDrivers: Driver[] = [];          // accumulated pages shown
  driverPanelPage      = 1;
  driverPanelHasMore   = false;
  loadingMorePanelDrivers = false;
  selectedDriverIds    = new Set<string>(); // checked driver IDs
  private _panelSearchTimer: any = null;

  constructor(
    private driverService: DriverService,
    private router: Router,
    private alertService: AlertService
  ) {}

  ngOnInit() {
    this.loadDrivers();
    this.loadGroups();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    const t = e.target as HTMLElement;
    if (!t.closest('.searchable-select')) this.groupDropdownOpen = false;
    // driver panel stays open until Cancel/Assign clicked
  }

  // ==================== DRIVER TABLE ====================

  async loadDrivers() {
    try {
      this.loading = true;
      this.drivers = [];
      this.tablePage = 1;
      const page = await this.driverService.getDriversPaginated(1, this.searchTerm);
      this.drivers         = page.drivers;
      this.filteredDrivers = [...this.drivers];
      this.tableHasMore    = page.hasMore;
      this.tablePage       = 2;
    } catch (e) {
      console.error('❌ Error loading drivers:', e);
      this.alertService.danger('Failed to load drivers');
    } finally {
      this.loading = false;
    }
  }

  async onTableScroll(event: Event) {
    if (!this.tableHasMore || this.loadingMoreTable || this.loading) return;
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 60) return;
    this.loadingMoreTable = true;
    try {
      const page = await this.driverService.getDriversPaginated(this.tablePage, this.searchTerm);
      const seen = new Set(this.drivers.map(d => d.id));
      this.drivers.push(...page.drivers.filter(d => !seen.has(d.id)));
      this.filteredDrivers = [...this.drivers];
      this.tableHasMore = page.hasMore;
      this.tablePage    = page.currentPage + 1;
    } catch (e) { console.error('❌ Load more drivers:', e); }
    finally { this.loadingMoreTable = false; }
  }

  filterDrivers() { this.loadDrivers(); }

  addDriver()             { this.router.navigate(['/drivers/add']); }
  editDriver(d: Driver)   { this.router.navigate(['/drivers/edit', d.id]); }
  manageShifts(d: Driver) {
    this.router.navigate(['/shifts'], { queryParams: { driverId: d.id, driverName: d.name } });
  }

  async deleteDriver(driver: Driver) {
    if (!confirm(`Delete driver ${driver.name}?`)) return;
    try {
      await this.driverService.deleteDriver(driver.id!);
      this.alertService.success('Driver deleted');
      await this.loadDrivers();
    } catch { this.alertService.danger('Failed to delete driver'); }
  }

  getActiveDriversCount() { return this.drivers.filter(d => d.status === 'active').length; }

  // ── Custom field helpers ──────────────────────────────────────
  hasCustomFields(driver: Driver): boolean {
    const cf = (driver as any).customFields;
    return cf && typeof cf === 'object' && Object.keys(cf).length > 0;
  }
  getCustomFieldsCount(driver: Driver): number {
    const cf = (driver as any).customFields;
    return (!cf || typeof cf !== 'object') ? 0 : Object.keys(cf).length;
  }
  getCustomFieldsArray(driver: Driver): Array<{ key: string; value: string }> {
    const cf = (driver as any).customFields;
    if (!cf || typeof cf !== 'object') return [];
    return Object.entries(cf).map(([key, value]) => ({ key, value: String(value) }));
  }

  // ==================== GROUPS ====================

  async loadGroups() {
    try {
      this.loadingGroups = true;
      const stored = localStorage.getItem('driverGroups');
      this.groups = stored
        ? JSON.parse(stored).map((g: any) => ({
            ...g,
            createdAt: new Date(g.createdAt),
            updatedAt: g.updatedAt ? new Date(g.updatedAt) : undefined
          }))
        : [];
      this.filteredGroups = [...this.groups];
    } catch {
      this.alertService.danger('Failed to load groups');
      this.groups = []; this.filteredGroups = [];
    } finally { this.loadingGroups = false; }
  }

  filterGroups() {
    const term = this.groupSearchTerm.toLowerCase().trim();
    this.filteredGroups = !term
      ? [...this.groups]
      : this.groups.filter(g =>
          g.name?.toLowerCase().includes(term) ||
          g.description?.toLowerCase().includes(term)
        );
  }

  addGroup() {
    this.editingGroup = null;
    this.groupForm = { name: '', description: '' };
    this.showGroupModal = true;
  }

  editGroup(group: DriverGroup) {
    this.editingGroup = group;
    this.groupForm = { name: group.name, description: group.description };
    this.showGroupModal = true;
  }

  async saveGroup() {
    if (!this.groupForm.name.trim()) { this.alertService.warning('Please enter a group name'); return; }
    try {
      if (this.editingGroup) {
        const idx = this.groups.findIndex(g => g.id === this.editingGroup!.id);
        if (idx !== -1) this.groups[idx] = { ...this.groups[idx], ...this.groupForm, updatedAt: new Date() };
        this.alertService.success('Group updated');
      } else {
        this.groups.push({ id: Date.now().toString(), ...this.groupForm, createdAt: new Date() });
        this.alertService.success('Group created');
      }
      localStorage.setItem('driverGroups', JSON.stringify(this.groups));
      this.filterGroups();
      this.closeGroupModal();
    } catch { this.alertService.danger('Failed to save group'); }
  }

  async deleteGroup(group: DriverGroup) {
    const count = this.getGroupDriverCount(group.id);
    let msg = `Delete "${group.name}"?`;
    if (count > 0) msg += `\n\nThis will remove ${count} driver(s) from this group.`;
    if (!confirm(msg)) return;
    try {
      // Remove this group from every driver that has it
      for (const driver of this.drivers.filter(d => d.groupIds?.includes(group.id))) {
        const updated = await this.driverService.removeDriverFromGroup(driver.id!, group.id);
        const idx = this.drivers.findIndex(d => d.id === driver.id);
        if (idx !== -1) this.drivers[idx] = updated;
      }
      this.groups = this.groups.filter(g => g.id !== group.id);
      localStorage.setItem('driverGroups', JSON.stringify(this.groups));
      this.filterGroups();
      this.filteredDrivers = [...this.drivers];
      this.alertService.success('Group deleted');
    } catch { this.alertService.danger('Failed to delete group'); }
  }

  closeGroupModal() {
    this.showGroupModal = false;
    this.editingGroup = null;
    this.groupForm = { name: '', description: '' };
  }

  // ==================== GROUP ↔ DRIVER RELATIONSHIPS ====================

  /** Group names for a driver (multiple) */
  getDriverGroupNames(driver: Driver): string[] {
    if (!driver.groupIds?.length) return [];
    return driver.groupIds
      .map(id => this.groups.find(g => g.id === id)?.name)
      .filter(Boolean) as string[];
  }

  /** Number of drivers that belong to a group */
  getGroupDriverCount(groupId: string): number {
    return this.drivers.filter(d => d.groupIds?.includes(groupId)).length;
  }

  /** Drivers belonging to a group */
  getGroupDrivers(groupId: string): Driver[] {
    return this.drivers.filter(d => d.groupIds?.includes(groupId));
  }

  // ==================== ASSIGN MODAL (open) ====================

  /** Open from driver row → pre-select no group; show group picker */
  openAssignFromDriver(driver: Driver) {
    this.selectedGroup = null;
    this.assignGroupId = '';
    this._openAssignModal();
    // Pre-tick the driver
    this.selectedDriverIds.clear();
    this.selectedDriverIds.add(driver.id!);
  }

  /** Open from group card → group pre-selected; pick drivers */
  addDriverToGroup(group: DriverGroup) {
    this.selectedGroup = group;
    this.assignGroupId = group.id;
    this._openAssignModal();
  }

  private _openAssignModal() {
    // Reset group selector
    this.groupDropdownOpen    = false;
    this.groupSelectSearch    = '';
    this.filteredGroupOptions = [...this.groups];
    // Reset driver multi-select panel
    this.selectedDriverIds   = new Set<string>();
    this._loadDriverPanelPage1();
    this.showAssignDriverModal = true;
  }

  closeAssignDriverModal() {
    this.showAssignDriverModal = false;
    this.selectedGroup   = null;
    this.assignGroupId   = '';
    this.showDriverPanel = false;
    this.groupDropdownOpen = false;
    this.driverPanelSearch = '';
  }

  // ==================== CONFIRM ASSIGN ====================

  async confirmAssignDriver() {
    const groupId = this.selectedGroup?.id || this.assignGroupId;
    if (!groupId) { this.alertService.warning('Please select a group'); return; }
    if (this.selectedDriverIds.size === 0) { this.alertService.warning('Please select at least one driver'); return; }

    try {
      const ids = Array.from(this.selectedDriverIds);
      const updated = await this.driverService.addMultipleDriversToGroup(ids, groupId);

      // Patch in-memory driver list
      for (const u of updated) {
        const idx = this.drivers.findIndex(d => d.id === u.id);
        if (idx !== -1) this.drivers[idx] = u;
        else this.drivers.push(u);
      }
      this.filteredDrivers = [...this.drivers];

      const groupName = this.getGroupName(groupId);
      this.alertService.success(
        `${ids.length} driver${ids.length > 1 ? 's' : ''} assigned to "${groupName}"`
      );
      this.closeAssignDriverModal();
    } catch {
      this.alertService.danger('Failed to assign drivers');
    }
  }

  async removeDriverFromGroup(driver: Driver, group: DriverGroup) {
    if (!confirm(`Remove ${driver.name} from "${group.name}"?`)) return;
    try {
      const updated = await this.driverService.removeDriverFromGroup(driver.id!, group.id);
      const idx = this.drivers.findIndex(d => d.id === driver.id);
      if (idx !== -1) this.drivers[idx] = updated;
      this.filteredDrivers = [...this.drivers];
      this.alertService.success(`${driver.name} removed from "${group.name}"`);
    } catch { this.alertService.danger('Failed to remove driver from group'); }
  }

  // ==================== SEARCHABLE GROUP DROPDOWN ====================

  toggleGroupDropdown() {
    this.groupDropdownOpen = !this.groupDropdownOpen;
    if (this.groupDropdownOpen) {
      this.groupSelectSearch    = '';
      this.filteredGroupOptions = [...this.groups];
    }
  }

  filterGroupOptions() {
    const term = this.groupSelectSearch.toLowerCase().trim();
    this.filteredGroupOptions = !term
      ? [...this.groups]
      : this.groups.filter(g =>
          g.name?.toLowerCase().includes(term) ||
          g.description?.toLowerCase().includes(term)
        );
  }

  selectGroup(group: DriverGroup) {
    this.assignGroupId     = group.id;
    this.selectedGroup     = group;
    this.groupDropdownOpen = false;
    this.groupSelectSearch = '';
  }

  getGroupName(groupId: string) {
    return this.groups.find(g => g.id === groupId)?.name ?? 'Unknown Group';
  }

  // ==================== MULTI-SELECT DRIVER PANEL ====================

  private async _loadDriverPanelPage1() {
    this.panelDrivers          = [];
    this.driverPanelPage       = 1;
    this.driverPanelHasMore    = false;
    this.driverPanelSearch     = '';
    this.loadingMorePanelDrivers = true;
    this.showDriverPanel         = true;
    try {
      const page = await this.driverService.getDriversPaginated(1, '');
      this.panelDrivers       = page.drivers;
      this.driverPanelHasMore = page.hasMore;
      this.driverPanelPage    = 2;
    } catch (e) { console.error('❌ Driver panel page 1 failed:', e); }
    finally { this.loadingMorePanelDrivers = false; }
  }

  /** Debounced search — resets to page 1 */
  onDriverPanelSearch() {
    clearTimeout(this._panelSearchTimer);
    this._panelSearchTimer = setTimeout(async () => {
      this.panelDrivers          = [];
      this.driverPanelPage       = 1;
      this.loadingMorePanelDrivers = true;
      try {
        const page = await this.driverService.getDriversPaginated(1, this.driverPanelSearch);
        this.panelDrivers       = page.drivers;
        this.driverPanelHasMore = page.hasMore;
        this.driverPanelPage    = 2;
      } catch (e) { console.error('❌ Driver panel search failed:', e); }
      finally { this.loadingMorePanelDrivers = false; }
    }, 300);
  }

  /** Scroll handler — loads next page when near bottom */
  async onDriverPanelScroll(event: Event) {
    if (!this.driverPanelHasMore || this.loadingMorePanelDrivers) return;
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight < el.scrollHeight - 40) return;
    this.loadingMorePanelDrivers = true;
    try {
      const page = await this.driverService.getDriversPaginated(this.driverPanelPage, this.driverPanelSearch);
      const seen = new Set(this.panelDrivers.map(d => d.id));
      this.panelDrivers.push(...page.drivers.filter(d => !seen.has(d.id)));
      this.driverPanelHasMore = page.hasMore;
      this.driverPanelPage    = page.currentPage + 1;
    } catch (e) { console.error('❌ Load more panel drivers:', e); }
    finally { this.loadingMorePanelDrivers = false; }
  }

  /** Toggle a single driver checkbox */
  toggleDriverSelection(driver: Driver) {
    const id = driver.id!;
    if (this.selectedDriverIds.has(id)) {
      this.selectedDriverIds.delete(id);
    } else {
      this.selectedDriverIds.add(id);
    }
  }

  /** Select / deselect all currently visible drivers */
  toggleSelectAll() {
    const allSelected = this.panelDrivers.every(d => this.selectedDriverIds.has(d.id!));
    if (allSelected) {
      this.panelDrivers.forEach(d => this.selectedDriverIds.delete(d.id!));
    } else {
      this.panelDrivers.forEach(d => this.selectedDriverIds.add(d.id!));
    }
  }

  get allVisibleSelected(): boolean {
    return this.panelDrivers.length > 0 &&
           this.panelDrivers.every(d => this.selectedDriverIds.has(d.id!));
  }

  get someVisibleSelected(): boolean {
    return this.panelDrivers.some(d => this.selectedDriverIds.has(d.id!)) && !this.allVisibleSelected;
  }

  /** Selected driver objects for the pill display */
  get selectedDriverObjects(): Driver[] {
    return Array.from(this.selectedDriverIds)
      .map(id => this.panelDrivers.find(d => d.id === id) ?? this.drivers.find(d => d.id === id))
      .filter(Boolean) as Driver[];
  }

  /** Remove a driver from selection via pill × button */
  deselectDriver(driver: Driver) {
    this.selectedDriverIds.delete(driver.id!);
  }

  // ==================== UTILITY ====================

  formatDate(date: Date): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    const diff = Math.ceil(Math.abs(Date.now() - d.getTime()) / 86400000);
    if (diff === 0)  return 'Today';
    if (diff === 1)  return 'Yesterday';
    if (diff < 7)    return `${diff} days ago`;
    if (diff < 30)   return `${Math.floor(diff / 7)} weeks ago`;
    if (diff < 365)  return `${Math.floor(diff / 30)} months ago`;
    return d.toLocaleDateString();
  }
}