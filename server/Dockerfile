# Multi-stage Dockerfile for building and running the Spring Boot backend
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /workspace

# Copy pom.xml first to leverage build cache (using image's Maven, no wrapper needed)
COPY pom.xml ./

# Copy source and build
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre

# Allow selecting which tesseract language packages to install at build time.
# Default installs English + OSD + Spanish + German + French traineddata packages.
ARG TESSDATA_PACKAGES="tesseract-ocr-eng tesseract-ocr-osd tesseract-ocr-spa tesseract-ocr-deu tesseract-ocr-fra"
ENV TESSDATA_PACKAGES=${TESSDATA_PACKAGES}

RUN apt-get update \
	&& apt-get install -y --no-install-recommends tesseract-ocr ${TESSDATA_PACKAGES} \
	&& rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy jar produced by the build stage (match any jar produced)
COPY --from=build /workspace/target/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
