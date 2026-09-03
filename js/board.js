let currentUserId = null;

(async function init() {
  const session = await JoyGolf.requireSession();
  if (!session) return;
  currentUserId = session.user.id;
  const profile = await JoyGolf.getOrCreateProfile(session.user);
  JoyGolf.renderNav("board", { isAdmin: profile.is_admin });
  await loadPosts();
  JoyGolf.revealCards();
})();

document.getElementById("postForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  try {
    const file = document.getElementById("postPhoto").files[0];
    let photoUrl = null;
    if (file) photoUrl = await JoyGolf.uploadProof(file, `board/${currentUserId}`);

    const { error } = await sb.from("posts").insert({
      user_id: currentUserId,
      title: document.getElementById("postTitle").value,
      content: document.getElementById("postContent").value || null,
      photo_url: photoUrl,
    });
    if (error) throw error;

    JoyGolf.showToast("✍️ 후기를 등록했어요!");
    document.getElementById("postForm").reset();
    await loadPosts();
  } catch (err) {
    JoyGolf.showToast("⚠️ " + (err.message || "등록 실패"));
  } finally {
    submitBtn.disabled = false;
  }
});

async function loadPosts() {
  const { data: posts, error } = await sb.from("posts").select("*").order("created_at", { ascending: false }).limit(50);
  const el = document.getElementById("postList");
  const empty = document.getElementById("postEmpty");
  if (error || !posts || !posts.length) {
    empty.style.display = "block";
    el.innerHTML = "";
    return;
  }
  empty.style.display = "none";

  const postIds = posts.map((p) => p.id);

  const [{ data: likes }, { data: comments }] = await Promise.all([
    sb.from("post_likes").select("*").in("post_id", postIds),
    sb.from("comments").select("*").in("post_id", postIds).order("created_at", { ascending: true }),
  ]);

  // 게시글 작성자뿐 아니라 댓글 작성자 프로필도 함께 조회해야 댓글에 "익명"이 뜨지 않음
  const userIds = [...new Set([...posts.map((p) => p.user_id), ...(comments || []).map((c) => c.user_id)])];
  const { data: profiles } = await sb.from("profiles").select("id, display_name, avatar_emoji").in("id", userIds);

  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  const likesByPost = {};
  (likes || []).forEach((l) => (likesByPost[l.post_id] ||= []).push(l));
  const commentsByPost = {};
  (comments || []).forEach((c) => (commentsByPost[c.post_id] ||= []).push(c));

  el.innerHTML = posts
    .map((p) => {
      const author = profileMap[p.user_id];
      const postLikes = likesByPost[p.id] || [];
      const iLiked = postLikes.some((l) => l.user_id === currentUserId);
      const postComments = commentsByPost[p.id] || [];

      return `
      <div class="card">
        <div class="list-item-head">
          <span>${author ? author.avatar_emoji : "🏌️"} <strong>${author ? JoyGolf.escapeHtml(author.display_name) : "익명"}</strong></span>
          <span class="hint">${JoyGolf.formatDate(p.created_at)}</span>
        </div>
        <h3 style="margin: 8px 0 4px;">${JoyGolf.escapeHtml(p.title)}</h3>
        ${p.content ? `<p style="white-space: pre-wrap;">${JoyGolf.escapeHtml(p.content)}</p>` : ""}
        ${p.photo_url ? `<img src="${p.photo_url}" class="proof-thumb" style="max-width:100%;" alt="후기 사진" />` : ""}

        <div style="margin-top:10px; display:flex; gap:8px; align-items:center;">
          <button class="btn btn-sm ${iLiked ? "btn-orange" : "btn-outline"}" onclick="toggleLike('${p.id}', ${iLiked})">❤️ ${postLikes.length}</button>
          ${p.user_id === currentUserId ? `<button class="btn btn-sm btn-danger" onclick="deletePost('${p.id}')">삭제</button>` : ""}
        </div>

        <div style="margin-top:12px; border-top:1px solid var(--border); padding-top:10px;">
          ${postComments
            .map((c) => {
              const cAuthor = profileMap[c.user_id];
              return `<div class="hint" style="margin-bottom:6px;">💬 <strong>${cAuthor ? JoyGolf.escapeHtml(cAuthor.display_name) : "익명"}</strong> ${JoyGolf.escapeHtml(c.content)}</div>`;
            })
            .join("")}
          <form class="commentForm" data-post-id="${p.id}" style="display:flex; gap:6px; margin-top:6px;">
            <input type="text" placeholder="댓글을 남겨보세요" style="flex:1;" required />
            <button type="submit" class="btn btn-sm">등록</button>
          </form>
        </div>
      </div>`;
    })
    .join("");

  document.querySelectorAll(".commentForm").forEach((form) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = form.querySelector("input");
      const { error } = await sb.from("comments").insert({
        post_id: form.dataset.postId,
        user_id: currentUserId,
        content: input.value,
      });
      if (error) {
        JoyGolf.showToast("⚠️ " + error.message);
        return;
      }
      await loadPosts();
    });
  });
}

window.toggleLike = async function toggleLike(postId, currentlyLiked) {
  if (currentlyLiked) {
    await sb.from("post_likes").delete().eq("post_id", postId).eq("user_id", currentUserId);
  } else {
    await sb.from("post_likes").insert({ post_id: postId, user_id: currentUserId });
  }
  await loadPosts();
};

window.deletePost = async function deletePost(id) {
  if (!confirm("이 게시글을 삭제할까요?")) return;
  const { error } = await sb.from("posts").delete().eq("id", id);
  if (error) {
    JoyGolf.showToast("⚠️ " + error.message);
    return;
  }
  JoyGolf.showToast("삭제했어요.");
  await loadPosts();
};
