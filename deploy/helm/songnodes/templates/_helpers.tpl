{{/*
Common helper templates for the SongNodes chart.
*/}}

{{- define "songnodes.standardLabels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
app.kubernetes.io/instance: {{ .Release.Name | quote }}
app.kubernetes.io/version: {{ .Chart.AppVersion | default .Chart.Version | quote }}
app.kubernetes.io/managed-by: {{ "Helm" | quote }}
{{- range $key, $value := .Values.global.commonLabels }}
{{ $key }}: {{ $value | quote }}
{{- end }}
{{- end }}

{{- define "songnodes.labels" -}}
{{- $ctx := .ctx -}}
{{- $custom := .labels | default dict -}}
{{- include "songnodes.standardLabels" $ctx }}
{{- range $key, $value := $custom }}
{{ $key }}: {{ $value | quote }}
{{- end }}
{{- end }}

{{- define "songnodes.annotations" -}}
{{- $annotations := .annotations | default dict -}}
{{- range $key, $value := $annotations }}
{{ $key }}: {{ $value | quote }}
{{- end }}
{{- range $key, $value := .ctx.Values.global.commonAnnotations }}
{{ $key }}: {{ $value | quote }}
{{- end }}
{{- end }}
