export interface AnalyzeResponse {
  message: string,
  containsPII: boolean,
  redactOriginalAudio?: boolean,
  audioUri: string,
  transcriptUri?: string,
  transcriptText?: string,
  piiIdentifications?: any[]
}

export interface ErrorResponse {
  message: string,
  error: any
}

export interface IdentificationResults {
  type: string,
  start_time: string,
  end_time: string,
  redactions: {
    confidence: number,
    type: string
    category: string
  }[]
}

export interface MuteTimestamps {
  start_time: string,
  end_time: string
}
