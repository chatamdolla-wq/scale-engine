// SCALE Engine — Output Module
// HTML document rendering, brand theming, and UI prototype generation

export { HTMLDocumentRenderer } from './HTMLDocumentRenderer.js'
export type {
  HTMLRenderOptions,
  OutputFormat,
  ThemeMode,
  DocLang,
  SpecData,
  PlanData,
  ReviewData,
  ReportData,
} from './HTMLDocumentRenderer.js'

export { BrandThemeLoader } from './BrandThemeLoader.js'
export type {
  BrandTheme,
  BrandColors,
  BrandTypography,
  BrandSpacing,
  BrandShadows,
} from './BrandThemeLoader.js'

export { UIPrototypeRenderer } from './UIPrototypeRenderer.js'
export type {
  PageSpec,
  ComponentSpec,
  NavItem,
  DashboardLayout,
  DashboardWidget,
  UIPrototypeOptions,
} from './UIPrototypeRenderer.js'
