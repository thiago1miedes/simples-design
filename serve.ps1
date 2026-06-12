$port = 3000
$root = $PSScriptRoot
$url  = "http://localhost:$port/"

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($url)
$listener.Start()

Write-Host ""
Write-Host "  Servidor rodando em http://localhost:$port" -ForegroundColor Green
Write-Host "  Pressione Ctrl+C para parar." -ForegroundColor Gray
Write-Host ""

$mime = @{
  ".html"=  "text/html; charset=utf-8"
  ".css" =  "text/css"
  ".js"  =  "application/javascript"
  ".json"=  "application/json"
  ".png" =  "image/png"
  ".jpg" =  "image/jpeg"
  ".jpeg"=  "image/jpeg"
  ".webp"=  "image/webp"
  ".svg" =  "image/svg+xml"
  ".ico" =  "image/x-icon"
  ".woff"=  "font/woff"
  ".woff2"= "font/woff2"
  ".ttf" =  "font/ttf"
  ".txt" =  "text/plain"
}

while ($listener.IsListening) {
  $ctx  = $listener.GetContext()
  $req  = $ctx.Request
  $res  = $ctx.Response

  $rawPath = $req.Url.LocalPath
  $path    = [System.Web.HttpUtility]::UrlDecode($rawPath)
  if ($path -eq "/" -or $path -eq "") { $path = "/index.html" }
  $file = Join-Path $root $path.TrimStart("/")

  if (Test-Path $file -PathType Leaf) {
    $ext         = [System.IO.Path]::GetExtension($file).ToLower()
    $contentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
    $bytes        = [System.IO.File]::ReadAllBytes($file)
    $res.ContentType   = $contentType
    $res.ContentLength64 = $bytes.Length
    $res.StatusCode    = 200
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    Write-Host "  200 $rawPath" -ForegroundColor DarkGray
  } else {
    $msg   = [System.Text.Encoding]::UTF8.GetBytes("404 - Not found")
    $res.StatusCode    = 404
    $res.ContentType   = "text/plain"
    $res.ContentLength64 = $msg.Length
    $res.OutputStream.Write($msg, 0, $msg.Length)
    Write-Host "  404 $rawPath" -ForegroundColor DarkYellow
  }

  $res.OutputStream.Close()
}
