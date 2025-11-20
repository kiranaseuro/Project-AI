package com.task.hwai.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.UUID;

public record ExtractionResult(
        @JsonProperty("file_id")
        String fileId,

        @JsonProperty("run_id")
        String runId,

        @JsonProperty("document_type")
        String documentType,

        @JsonProperty("pages")
        List<Page> pages,

        @JsonProperty("warnings")
        List<String> warnings,

        @JsonProperty("processing_time_ms")
        long processingTimeMs
)  {

    public record Page(
            @JsonProperty("page")
            int page,

            @JsonProperty("fields")
            List<Field> fields,

            @JsonProperty("tables")
            List<Table> tables
    ) {}

    public record Field(
            @JsonProperty("name")
            String name,

            @JsonProperty("value")
            Object value,

            @JsonProperty("confidence")
            Double confidence,

            @JsonProperty("bbox")
            List<Double> bbox
    ) {}

    public record Table(
            @JsonProperty("name")
            String name,

            @JsonProperty("rows")
            List<java.util.Map<String, Object>> rows,

            @JsonProperty("confidence")
            Double confidence
    ) {}
}
