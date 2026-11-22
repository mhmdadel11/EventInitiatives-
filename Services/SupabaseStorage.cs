using System.Net.Http.Headers;
using System.Text.Json;

namespace EventInitiatives.Mvc.Services;

public sealed class SupabaseStorage
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    public SupabaseStorage(HttpClient http, IConfiguration config) { _http = http; _config = config; }
    private string Url => (_config["Supabase:Url"] ?? "").TrimEnd('/');
    private string Key => _config["Supabase:ServiceRoleKey"] ?? "";
    private string Bucket => _config["Supabase:Bucket"] ?? "event-media";
    private void Configure(HttpRequestMessage request)
    {
        if (string.IsNullOrWhiteSpace(Url) || string.IsNullOrWhiteSpace(Key))
            throw new InvalidOperationException("Supabase Storage settings are missing. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
        request.Headers.Add("apikey", Key);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Key);
    }
    public async Task UploadAsync(string objectPath, Stream content, string contentType, CancellationToken ct = default)
    {
        var url = $"{Url}/storage/v1/object/{Uri.EscapeDataString(Bucket)}/{EncodePath(objectPath)}";
        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        Configure(req); req.Headers.Add("x-upsert", "true");
        var body = new StreamContent(content); body.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        req.Content = body;
        using var response = await _http.SendAsync(req, ct);
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException("Supabase upload failed: " + await response.Content.ReadAsStringAsync(ct));
    }
    public async Task<(Stream Stream, string? ContentType)> DownloadAsync(string objectPath, CancellationToken ct = default)
    {
        var url = $"{Url}/storage/v1/object/authenticated/{Uri.EscapeDataString(Bucket)}/{EncodePath(objectPath)}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url); Configure(req);
        var response = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!response.IsSuccessStatusCode) { var message = await response.Content.ReadAsStringAsync(ct); response.Dispose(); throw new FileNotFoundException(message); }
        var stream = await response.Content.ReadAsStreamAsync(ct);
        return (new ResponseOwnedStream(stream, response), response.Content.Headers.ContentType?.ToString());
    }
    public async Task DeleteAsync(string objectPath, CancellationToken ct = default)
    {
        var url = $"{Url}/storage/v1/object/{Uri.EscapeDataString(Bucket)}";
        using var req = new HttpRequestMessage(HttpMethod.Delete, url); Configure(req);
        req.Content = new StringContent(JsonSerializer.Serialize(new { prefixes = new[] { objectPath } }), System.Text.Encoding.UTF8, "application/json");
        using var response = await _http.SendAsync(req, ct);
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException("Supabase delete failed: " + await response.Content.ReadAsStringAsync(ct));
    }
    private static string EncodePath(string path) => string.Join('/', path.Split('/').Select(Uri.EscapeDataString));
    private sealed class ResponseOwnedStream : Stream
    {
        private readonly Stream _inner; private readonly HttpResponseMessage _response;
        public ResponseOwnedStream(Stream inner, HttpResponseMessage response) { _inner = inner; _response = response; }
        protected override void Dispose(bool disposing) { if (disposing) { _inner.Dispose(); _response.Dispose(); } base.Dispose(disposing); }
        public override async ValueTask DisposeAsync() { await _inner.DisposeAsync(); _response.Dispose(); GC.SuppressFinalize(this); }
        public override bool CanRead => _inner.CanRead; public override bool CanSeek => _inner.CanSeek; public override bool CanWrite => false;
        public override long Length => _inner.Length; public override long Position { get => _inner.Position; set => _inner.Position = value; }
        public override int Read(byte[] b,int o,int c)=>_inner.Read(b,o,c); public override ValueTask<int> ReadAsync(Memory<byte> b,CancellationToken t=default)=>_inner.ReadAsync(b,t);
        public override long Seek(long o,SeekOrigin so)=>_inner.Seek(o,so); public override void Flush()=>_inner.Flush(); public override void SetLength(long v)=>throw new NotSupportedException(); public override void Write(byte[] b,int o,int c)=>throw new NotSupportedException();
    }
}
