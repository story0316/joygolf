let currentUserId = null;

(async function init() {
  const session = await JoyGolf.requireSession();
  if (!session) return;
  currentUserId = session.user.id;
  const profile = await JoyGolf.getOrCreateProfile(session.user);
  JoyGolf.renderNav("board", { isAdmin: profile.is_admin });

  document.getElementById("postList").innerHTML = JoyGolf.skeleton(3);
  await loadPosts();
})();

document.getElementById("postForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "등록 중…";

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
    submitBtn.textContent = "✍️ 등록하기";
  }
});

async function loadPosts() {
  const { data: posts, error } = await sb
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const el = document.getElementById("postList");
  const rows = error ? [] : posts || [];

  document.getElementById("postEmpty").hidden = rows.length > 0;

  if (!rows.length) {
    el.innerHTML = "";
    return;
  }

  const postIds = rows.map((p) => p.id);

  const [{ data: likes }, { data: comments }] = await Promise.all([
    sb.from("post_likes").select("*").in("post_id", postIds),
    sb.from("comments").select("*").in("post_id", postIds).order("created_at", { ascending: true }),
  ]);

  // 글 작성자뿐 아니라 댓글 작성자 프로필까지 함께 조회해야 댓글에 "익명"이 뜨지 않는다
  const userIds = [...new Set([...rows.map((p) => p.user_id), ...(comments || []).map((c) => c.user_id)])];
  const { data: profiles } = await sb.from("profiles").select("id, display_name, avatar_emoji").in("id", userIds);

  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  const likesByPost = {};
  (likes || []).forEach((l) => (likesByPost[l.post_id] ||= []).push(l));
  const commentsByPost = {};
  (comments || []).forEach((c) => (commentsByPost[c.post_id] ||= []).push(c));

  el.innerHTML = rows
    .map((p) => {
      const author = profileMap[p.user_id];
      const postLikes = likesByPost[p.id] || [];
      const iLiked = postLikes.some((l) => l.user_id === currentUserId);
      const postComments = commentsByPost[p.id] || [];

      return `
      <article class="card card-hover mb-0">
        <div class="card-head" style="margin-bottom: 12px;">
          <span class="card-icon">${author ? author.avatar_emoji : "🏌️"}</span>
          <div class="flex-1">
            <strong>${author ? JoyGolf.escapeHtml(author.display_name) : "익명"}</strong>
            <p class="hint mt-0">${JoyGolf.formatDate(p.created_at)}</p>
          </div>
        </div>

        <h3 style="font-size: 1.15rem; margin-bottom: 8px;">${JoyGolf.escapeHtml(p.title)}</h3>
        ${p.content ? `<p style="white-space: pre-wrap; margin: 0;">${JoyGolf.escapeHtml(p.content)}</p>` : ""}
        ${
          p.photo_url
            ? `<img src="${p.photo_url}" class="proof-thumb" style="max-width: 100%;" alt="후기 사진" loading="lazy" />`
            : ""
        }

        <div class="list-item-actions">
          <button class="btn btn-sm ${iLiked ? "" : "btn-outline"}" onclick="toggleLike('${p.id}', ${iLiked})">
            ${iLiked ? "❤️" : "🤍"} ${postLikes.length}
          </button>
          <span class="btn btn-sm btn-ghost" style="cursor: default;">💬 ${postComments.length}</span>
          ${
            p.user_id === currentUserId
              ? `<button class="btn btn-sm btn-danger row-end" onclick="deletePost('${p.id}')">삭제</button>`
              : ""
          }
        </div>

        <hr class="divider" />

        ${postComments
          .map((c) => {
            const cAuthor = profileMap[c.user_id];
            return `<div class="timeline-item" style="margin-bottom: 10px;">
              <span class="timeline-icon">${cAuthor ? cAuthor.avatar_emoji : "🏌️"}</span>
              <div class="flex-1">
                <strong style="font-size: 0.86rem;">${cAuthor ? JoyGolf.escapeHtml(cAuthor.display_name) : "익명"}</strong>
                <p class="hint mt-0" style="color: var(--text-muted);">${JoyGolf.escapeHtml(c.content)}</p>
              </div>
            </div>`;
          })
          .join("")}

        <form class="commentForm" data-post-id="${p.id}" style="display: flex; gap: 8px; margin-top: 12px;">
          <input type="text" placeholder="댓글을 남겨보세요" required />
          <button type="submit" class="btn btn-sm">등록</button>
        </form>
      </article>`;
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
