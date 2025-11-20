package com.task.hwai.controller;

import java.nio.file.Path;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.Objects;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.task.hwai.model.ExtractionResult;
import com.task.hwai.model.RunResponse;
import com.task.hwai.model.RunStatus;
import com.task.hwai.repo.ExtractionRepo;
import com.task.hwai.repo.FileRepo;
import com.task.hwai.repo.RunRepo;
import com.task.hwai.service.AgentService;

@RestController
@RequestMapping("/v1")
@CrossOrigin(origins = "http://localhost:3000")
public class RunController {
    private final RunRepo runRepo;
    private final ExtractionRepo extractionRepo;
    private final FileRepo fileRepo;
    private final AgentService agent;

    public RunController(RunRepo runRepo, ExtractionRepo extractionRepo, FileRepo fileRepo, AgentService agent) {
        this.runRepo = runRepo;
        this.extractionRepo = extractionRepo;
        this.fileRepo = fileRepo;
        this.agent = agent;
    }

    @GetMapping("/runs/{runId}")
    public ResponseEntity<RunResponse> getRun(@PathVariable UUID runId) throws Exception {
        var run = runRepo.findById(runId).orElse(null);
        if (run == null) return ResponseEntity.notFound().build();

        // MVP: if still queued → trigger processing synchronously
        if (run.getStatus() == RunStatus.QUEUED) {
            try {
                var file = fileRepo.findById(run.getFileId()).orElseThrow(() -> new Exception("File not found"));
                var result = agent.run(file.getFileId(), runId, Path.of(file.getStorageUri()));
                return ResponseEntity.ok(new RunResponse(RunStatus.COMPLETED, result, null));
            } catch (Exception e) {
                System.err.println("Error processing queued run: " + e.getMessage());
                e.printStackTrace();
                run.setStatus(RunStatus.FAILED);
                run.setError(e.getMessage());
                runRepo.save(run);
                return ResponseEntity.ok(new RunResponse(RunStatus.FAILED, null, e.getMessage()));
            }
        }

        if (run.getStatus() == RunStatus.COMPLETED) {
            var ex = extractionRepo.findByRunId(runId).orElse(null);
            ExtractionResult result = null;
            try {
                result = ex != null && ex.getResultJson() != null ? JsonUtil.read(ex.getResultJson(), ExtractionResult.class) : null;
            } catch (Exception e) {
                System.err.println("Error deserializing extraction result: " + e.getMessage());
                e.printStackTrace();
                return ResponseEntity.ok(new RunResponse(RunStatus.COMPLETED, null, "Failed to deserialize result: " + e.getMessage()));
            }
            return ResponseEntity.ok(new RunResponse(RunStatus.COMPLETED, result, null));
        }

        if (run.getStatus() == RunStatus.FAILED) {
            return ResponseEntity.ok(new RunResponse(RunStatus.FAILED, null, run.getError()));
        }

        return ResponseEntity.ok(new RunResponse(run.getStatus(), null, null));
    }

    @PostMapping("/runs/{runId}")
    public ResponseEntity<RunResponse> postRun(@PathVariable UUID runId) throws Exception {
        // Allow clients to POST to the same resource to trigger processing (returns same shape as GET)
        var run = runRepo.findById(runId).orElse(null);
        if (run == null) return ResponseEntity.notFound().build();

        if (run.getStatus() == RunStatus.QUEUED) {
            try {
                var file = fileRepo.findById(run.getFileId()).orElseThrow(() -> new Exception("File not found"));
                var result = agent.run(file.getFileId(), runId, Path.of(file.getStorageUri()));
                return ResponseEntity.ok(new RunResponse(RunStatus.COMPLETED, result, null));
            } catch (Exception e) {
                System.err.println("Error processing queued run: " + e.getMessage());
                e.printStackTrace();
                run.setStatus(RunStatus.FAILED);
                run.setError(e.getMessage());
                runRepo.save(run);
                return ResponseEntity.ok(new RunResponse(RunStatus.FAILED, null, e.getMessage()));
            }
        }

        if (run.getStatus() == RunStatus.COMPLETED) {
            var ex = extractionRepo.findByRunId(runId).orElse(null);
            ExtractionResult result = null;
            try {
                result = ex != null && ex.getResultJson() != null ? JsonUtil.read(ex.getResultJson(), ExtractionResult.class) : null;
            } catch (Exception e) {
                System.err.println("Error deserializing extraction result: " + e.getMessage());
                e.printStackTrace();
                return ResponseEntity.ok(new RunResponse(RunStatus.COMPLETED, null, "Failed to deserialize result: " + e.getMessage()));
            }
            return ResponseEntity.ok(new RunResponse(RunStatus.COMPLETED, result, null));
        }

        if (run.getStatus() == RunStatus.FAILED) {
            return ResponseEntity.ok(new RunResponse(RunStatus.FAILED, null, run.getError()));
        }

        return ResponseEntity.ok(new RunResponse(run.getStatus(), null, null));
    }

    @PostMapping("/exports")
    public ResponseEntity<?> export(@RequestBody ExportReq req) {
        var ex = extractionRepo.findByRunId(req.runId()).orElse(null);
        if (ex == null) return ResponseEntity.notFound().build();
        if ("csv".equalsIgnoreCase(req.format())) {
            var csv = CsvUtil.fromExtractionJson(ex.getResultJson());
            return ResponseEntity.ok()
                    .header("Content-Disposition", "attachment; filename=extraction.csv")
                    .body(csv);
        }
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=extraction.json")
                .body(ex.getResultJson());
    }

    // CRUD Operations for Extractions
    @GetMapping("/extractions")
    public ResponseEntity<List<ExtractionSummary>> getAllExtractions() {
        List<com.task.hwai.entity.ExtractionEntity> entities = extractionRepo.findAll();
        List<ExtractionSummary> summaries = entities.stream()
                .map(entity -> new ExtractionSummary(
                        entity.getRunId(),
                        entity.getDocumentType(),
                        entity.getAvgConfidence(),
                        entity.getCreatedAt()
                ))
                .collect(Collectors.toList());
        return ResponseEntity.ok(summaries);
    }

    @GetMapping("/extractions/{runId}")
    public ResponseEntity<ExtractionResult> getExtraction(@PathVariable UUID runId) {
        var entity = extractionRepo.findByRunId(runId);
        if (entity.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        ExtractionResult result = JsonUtil.read(entity.get().getResultJson(), ExtractionResult.class);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/extractions/{runId}")
    public ResponseEntity<ExtractionResult> updateExtraction(
            @PathVariable UUID runId,
            @RequestBody ExtractionResult updatedResult) {

        var entity = extractionRepo.findByRunId(runId);
        if (entity.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        // Validate the run exists
        var run = runRepo.findById(runId);
        if (run.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        // Update the entity
        entity.get().setResultJson(JsonUtil.writeValueAsString(updatedResult));
        entity.get().setAvgConfidence(calculateAverageConfidence(updatedResult));
        entity.get().setDocumentType(updatedResult.documentType());

        extractionRepo.save(entity.get());

        return ResponseEntity.ok(updatedResult);
    }

    @DeleteMapping("/extractions/{runId}")
    public ResponseEntity<Void> deleteExtraction(@PathVariable UUID runId) {
        var entity = extractionRepo.findByRunId(runId);
        if (entity.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        // Also update the run status to reflect deletion
        var run = runRepo.findById(runId);
        if (run.isPresent()) {
            run.get().setStatus(RunStatus.FAILED);
            run.get().setError("Extraction manually deleted");
            runRepo.save(run.get());
        }

        extractionRepo.deleteById(entity.get().getId());
        return ResponseEntity.ok().build();
    }

    // Helper method to calculate average confidence
    private Double calculateAverageConfidence(ExtractionResult r) {
        if (r == null || r.pages() == null) return null;

        return r.pages().stream()
                .filter(Objects::nonNull)
                .flatMap(p -> p.fields() == null ? Stream.empty() : p.fields().stream())
                .map(com.task.hwai.model.ExtractionResult.Field::confidence)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(0.0);
    }

    public record ExportReq(UUID runId, String format) {}

    public record ExtractionSummary(
            UUID runId,
            String documentType,
            Double avgConfidence,
            java.time.Instant createdAt
    ) {}

    // tiny json/csv helpers (inline for brevity)
    // tiny json helper (snake_case tolerant + ignore unknowns)
    static class JsonUtil {
        private static final com.fasterxml.jackson.databind.ObjectMapper M =
                new com.fasterxml.jackson.databind.ObjectMapper()
                        .setPropertyNamingStrategy(
                                com.fasterxml.jackson.databind.PropertyNamingStrategies.SNAKE_CASE)
                        .configure(
                                com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES,
                                false);

        static <T> T read(String s, Class<T> t) {
            try {
                return M.readValue(s, t);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        static String writeValueAsString(Object obj) {
            try {
                return M.writeValueAsString(obj);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }
    }


    static class CsvUtil {
        static String fromExtractionJson(String json) {
            var M = new com.fasterxml.jackson.databind.ObjectMapper();
            try {
                var node = M.readTree(json);
                var pages = node.get("pages");
                var sb = new StringBuilder("page,field,value,confidence\n");
                if (pages != null && pages.isArray()) {
                    for (var p : pages) {
                        int page = p.path("page").asInt(1);
                        var fields = p.get("fields");
                        if (fields != null && fields.isArray()) {
                            for (var f : fields) {
                                sb.append(page).append(",")
                                        .append(escapeNode(f.get("name"))).append(",")
                                        .append(escapeNode(f.get("value"))).append(",")
                                        .append(safeText(f.get("confidence")))
                                        .append("\n");
                            }
                        }
                    }
                }
                return sb.toString();
            } catch (Exception e) { throw new RuntimeException(e); }
        }
        static String safeText(com.fasterxml.jackson.databind.JsonNode n) {
            if (n == null || n.isNull()) return "";
            return n.isValueNode() ? n.asText("") : n.toString();
        }
        static String escape(String s){ if (s==null) s=""; return "\"" + s.replace("\"","\"\"") + "\""; }
        static String escapeNode(com.fasterxml.jackson.databind.JsonNode n) { return escape(safeText(n)); }
    }
}