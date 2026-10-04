import {
  cloneDefaultWidgets,
  DEFAULT_WIDGETS,
} from '@/store/collectionStore.defaults';
import type {
  CollectionStoreCreator,
  CollectionStoreDependencies,
  DashboardLayoutSlice,
} from '@/store/collectionStore.types';

export function createDashboardLayoutSlice(
  dependencies: CollectionStoreDependencies,
): CollectionStoreCreator<DashboardLayoutSlice> {
  return (set, get) => ({
    dashboardWidgets: cloneDefaultWidgets(),

    toggleWidgetVisibility: (id) => {
      set((state) => ({
        dashboardWidgets: state.dashboardWidgets.map((widget) => (
          widget.id === id ? { ...widget, visible: !widget.visible } : widget
        )),
      }));
      dependencies.syncSettings({ dashboardWidgets: get().dashboardWidgets });
    },

    moveWidget: (id, direction) => {
      set((state) => {
        const widgets = [...state.dashboardWidgets].sort((left, right) => left.order - right.order);
        const index = widgets.findIndex((widget) => widget.id === id);
        if (index === -1) return state;

        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= widgets.length) return state;

        const currentOrder = widgets[index].order;
        widgets[index] = { ...widgets[index], order: widgets[swapIndex].order };
        widgets[swapIndex] = { ...widgets[swapIndex], order: currentOrder };

        return { dashboardWidgets: widgets };
      });
      dependencies.syncSettings({ dashboardWidgets: get().dashboardWidgets });
    },

    setWidgetSize: (id, size) => {
      set((state) => ({
        dashboardWidgets: state.dashboardWidgets.map((widget) => (
          widget.id === id ? { ...widget, size } : widget
        )),
      }));
      dependencies.syncSettings({ dashboardWidgets: get().dashboardWidgets });
    },

    setDashboardWidgets: (widgets) => {
      const nextWidgets = widgets.map((widget, index) => ({ ...widget, order: index }));
      set({ dashboardWidgets: nextWidgets });
      dependencies.syncSettings({ dashboardWidgets: nextWidgets });
    },

    resetDashboardLayout: () => {
      const nextWidgets = cloneDefaultWidgets();
      set({ dashboardWidgets: nextWidgets });
      dependencies.syncSettings({ dashboardWidgets: nextWidgets.length > 0 ? nextWidgets : DEFAULT_WIDGETS });
    },
  });
}
