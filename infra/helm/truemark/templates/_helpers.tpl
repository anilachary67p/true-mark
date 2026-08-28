{{- define "truemark.name" -}}
{{- .Chart.Name }}
{{- end }}

{{- define "truemark.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
