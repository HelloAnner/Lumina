/**
 * 阅读器入口分发
 *
 * @author Anner
 * @since 0.1.0
 * Created on 2026/3/23
 */
"use client"

import type { ReaderClientProps } from "@/components/reader/reader-types"
import { EpubReaderClient } from "@/components/reader/epub-reader-client"

export function ReaderClient(props: ReaderClientProps) {
  return <EpubReaderClient {...props} />
}
