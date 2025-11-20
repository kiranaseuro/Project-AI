package com.task.hwai.service;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

public interface OcrTool {

    List<PageResult> extract(Path path) throws Exception;

    record Token(String text, double x, double y, double w, double h, Double confidence) {
        // Convenience constructor: allow creating a Token with only text and confidence.
        public Token(String text, double confidence) {
            this(text, 0.0d, 0.0d, 0.0d, 0.0d, Double.valueOf(confidence));
        }
    }

    record PageResult(int page, List<Token> tokens, List<Map<String, Object>> metadata) {
        // Convenience constructor for existing two-arg usages
        public PageResult(int page, List<Token> tokens) {
            this(page, tokens, List.of(Map.of()));
        }
    }
}
