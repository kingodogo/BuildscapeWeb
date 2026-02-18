# Media Upload Setup Guide

This guide explains how to set up the media upload feature for the wiki.

## Overview

The wiki now supports direct file uploads for images and videos. Files are automatically uploaded to ImgBB (a free image hosting service) and the resulting URL is stored in the database.

## Setup Instructions

### 1. Get an ImgBB API Key

1. Go to https://api.imgbb.com/
2. Sign up for a free account (or log in if you already have one)
3. Navigate to the API section
4. Copy your API key

### 2. Add API Key to Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new environment variable:
   - **Name**: `IMGBB_API_KEY`
   - **Value**: Your ImgBB API key
   - **Environment**: Production, Preview, Development (select all)
4. Click **Save**

### 3. Redeploy Your Application

After adding the environment variable, you need to redeploy your application for the changes to take effect:

1. Go to your Vercel project dashboard
2. Click on the **Deployments** tab
3. Click the **...** menu on the latest deployment
4. Select **Redeploy**

Or simply push a new commit to trigger a new deployment.

## Features

- **File Upload**: Upload images (JPEG, PNG, GIF, WebP, SVG) or videos (MP4, WebM, OGG)
- **File Size Limit**: Up to 32MB per file (ImgBB free tier limit)
- **Automatic Hosting**: Files are automatically uploaded to ImgBB cloud storage
- **URL Storage**: Only the URL is stored in the database, not the file itself
- **Preview**: See a preview of uploaded media before saving
- **Fallback**: You can still paste URLs directly if you prefer

## Usage

1. In the Wiki admin panel, when creating or editing a feature:
2. Click **"Choose File to Upload"** button
3. Select an image or video file from your computer
4. Wait for the upload to complete (progress bar will show)
5. The media URL will be automatically filled in
6. A preview will appear below the input
7. Save the feature as usual

## Alternative: Direct URL Input

You can still paste URLs directly into the URL field below the upload button. This supports:
- Direct image/video URLs
- YouTube links
- Vimeo links
- Google Drive links (set to "Anyone with link")
- Any other publicly accessible media URL

## Troubleshooting

### "Image upload service not configured" error

- Make sure you've added `IMGBB_API_KEY` to your Vercel environment variables
- Redeploy your application after adding the environment variable
- Check that the API key is correct

### Upload fails

- Check file size (must be under 32MB)
- Check file type (must be a supported image or video format)
- Check your internet connection
- Verify your ImgBB API key is valid and has not expired

### Preview not showing

- Make sure the upload completed successfully
- Check the browser console for errors
- Try refreshing the page

## ImgBB Free Tier Limits

- **File Size**: 32MB per file
- **Storage**: Unlimited (as long as files are accessed regularly)
- **Bandwidth**: Generous free tier
- **API Calls**: 1000 requests per day (should be plenty for most use cases)

For higher limits, you can upgrade to ImgBB Pro, or switch to another service like Cloudinary, AWS S3, or Google Cloud Storage.

