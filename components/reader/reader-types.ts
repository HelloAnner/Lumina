/**
 * 阅读器共享类型
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
import type {
  Book,
  BookTocTranslation,
  BookTranslation,
  Highlight,
  ReaderSettings
} from "@/src/server/store/types"
import type { ReaderProgressRecord } from "@/src/server/services/books/progress"
import type {
  ReaderLayoutState,
  UiPreferences
} from "@/src/server/services/preferences/store"

export type SidebarNode = {
  id: string
  title: string
  sourceIndex: number
  level: number
  children: SidebarNode[]
}

export type ResolvedHighlight = Highlight & {
  sectionIndex: number
  paragraphIndex: number
  start: number
  end: number
  displayContent: string
}

export interface SharedReaderView {
  readOnly: true
  token: string
  ownerName: string
  expiresAt?: string | null
  publicFileUrl?: string
}

export interface ReaderClientProps {
  book: Book
  highlights: Highlight[]
  initialProgress: ReaderProgressRecord
  initialWidths: UiPreferences
  initialLayout: ReaderLayoutState
  settings?: ReaderSettings
  initialTranslations?: BookTranslation[]
  initialTocTranslation?: BookTocTranslation | null
  sharedView?: SharedReaderView
}
