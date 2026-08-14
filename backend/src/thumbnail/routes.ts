import type {FastifyInstance} from "fastify";
import {z} from "zod";
import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";

import type {BackendAppContext} from "../app";
import {extractSpeakerFrame} from "./extractor";
import {generateThumbnailPrompt} from "./prompter";
import {generateThumbnailImage} from "./generator";

const thumbnailRequestSchema = z.object({
  styleReferenceName: z.string().optional(),
  targetTimestamp: z.number().optional()
});

export const registerThumbnailRoutes = async (
  app: FastifyInstance,
  context: BackendAppContext
): Promise<void> => {
  app.post("/api/jobs/:jobId/thumbnail", async (req, reply) => {
    try {
      const params = req.params as {jobId: string};
      const body = thumbnailRequestSchema.parse(req.body ?? {});

      let transcriptSnippet = "A video about an interesting topic.";
      let videoSourcePath = "";

      if (params.jobId === "test") {
        videoSourcePath = "C:\\Users\\HomePC\\Downloads\\HELP, VIDEO MATTING\\backend\\data\\edit-sessions\\_live-preview-upload-cache\\1776705931071-Dan-Martell--Scared-of-Achieving-SHORT-VER.mp4";
        transcriptSnippet = "A highly motivational video by Dan Martell about the fear of achieving success and pushing through mental barriers.";
      } else {
        // 1. Get Job Information
        const job = await context.service.getJob(params.jobId);
        const sourceMedia = await context.editSessions.getSourceMediaAsset(params.jobId);
        if (!sourceMedia || !sourceMedia.filePath) {
          throw new Error("Job does not have a source video path.");
        }
        videoSourcePath = sourceMedia.filePath;

        // Try to get transcript if available
        try {
          const metadata = await context.service.getMetadataProfile(params.jobId);
          const userIntent = metadata?.user_intent as Record<string, any> | undefined;
          if (userIntent && userIntent.objective) {
            transcriptSnippet = String(userIntent.objective);
          } else if (job.request_summary.prompt_excerpt) {
            transcriptSnippet = job.request_summary.prompt_excerpt;
          }
        } catch (e) {
          // Ignore if metadata is not ready
        }
      }

      // 2. Extract Frame
      const frameBuffer = await extractSpeakerFrame(videoSourcePath, body.targetTimestamp);

      // 3. Generate Prompt (LLaMA-3)
      const promptResult = await generateThumbnailPrompt(context.env, {
        transcriptSnippet,
        styleReferenceName: body.styleReferenceName
      });

      if (!promptResult) {
        throw new Error("Failed to generate thumbnail prompt via Groq.");
      }

      // 4. Generate Thumbnail Image (API Stub)
      const thumbnailBuffer = await generateThumbnailImage(context.env, {
        frameBuffer,
        textPrompt: promptResult.keywords,
        visualPrompt: promptResult.visualPrompt
      });

      // 5. Upload to R2
      const r2Endpoint = context.env.R2_ENDPOINT.trim() || (context.env.R2_ACCOUNT_ID ? `https://${context.env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com` : "");
      let publicUrl: string | null = null;
      let s3Key: string | null = null;

      if (r2Endpoint && context.env.R2_ACCESS_KEY_ID && context.env.R2_UPLOAD_BUCKET) {
        const s3 = new S3Client({
          region: "auto",
          endpoint: r2Endpoint,
          credentials: {
            accessKeyId: context.env.R2_ACCESS_KEY_ID.trim(),
            secretAccessKey: context.env.R2_SECRET_ACCESS_KEY.trim()
          }
        });

        const key = `uploads/thumbnails/${params.jobId}-${Date.now()}.jpg`;
        await s3.send(new PutObjectCommand({
          Bucket: context.env.R2_UPLOAD_BUCKET.trim(),
          Key: key,
          Body: thumbnailBuffer,
          ContentType: "image/jpeg"
        }));

        s3Key = key;
        const publicBase = context.env.R2_PUBLIC_UPLOADS_BASE.trim();
        publicUrl = publicBase ? `${publicBase.replace(/\/+$/, "")}/${key}` : null;
      }

      reply.code(200);
      return {
        job_id: params.jobId,
        keywords: promptResult.keywords,
        visual_prompt: promptResult.visualPrompt,
        color_theme: promptResult.colorTheme,
        subject_expression: promptResult.subjectExpression,
        layout_zones: promptResult.layoutZones,
        r2_key: s3Key,
        public_url: publicUrl,
        base64_image: thumbnailBuffer.toString("base64"),
        message: "Thumbnail generated successfully based on high-CTR blueprint."
      };
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });
};
