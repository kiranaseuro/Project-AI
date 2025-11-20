package com.task.hwai.service;

import java.io.File;
import java.nio.file.Path;
import java.util.List;

import org.springframework.stereotype.Service;

import net.sourceforge.tess4j.ITesseract;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;

@Service
public class SimpleOcrTool implements OcrTool {

    @Override
    public List<PageResult> extract(Path path) {
        // Support configurable tessdata path via environment variable `TESSDATA_PATH` or `TESSDATA_PREFIX`.
        // Fall back to common Linux location where tesseract installs its tessdata.
        String tessdata = System.getenv("TESSDATA_PATH");
        if (tessdata == null || tessdata.isEmpty()) {
            tessdata = System.getenv("TESSDATA_PREFIX");
        }
        if (tessdata == null || tessdata.isEmpty()) {
            tessdata = "/usr/share/tessdata"; // default for most Linux packages
        }

        // Defensive check: ensure required traineddata file exists before invoking native code.
        java.nio.file.Path engData = java.nio.file.Path.of(tessdata, "eng.traineddata");
        if (!java.nio.file.Files.exists(engData)) {
            String msg = String.format("Tesseract traineddata not found: %s. Set TESSDATA_PATH or mount tessdata.", engData);
            System.err.println(msg);
            throw new RuntimeException(msg);
        }

        ITesseract tesseract = new Tesseract();
        tesseract.setDatapath(tessdata);
        tesseract.setLanguage("eng");

        try {
            String text = tesseract.doOCR(new File(path.toString()));
            System.out.println("✔ OCR Extracted:\n" + text);

            Token token = new Token(text.trim(), 0.92f);

            PageResult page = new PageResult(
                    1,
                    List.of(token),
                    List.of()
            );

            return List.of(page);

        } catch (TesseractException e) {
            throw new RuntimeException("Tesseract OCR failed: " + e.getMessage(), e);
        }
    }
}