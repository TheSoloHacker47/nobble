class AdminPolicy
  def allow?(user)
    user.role == "admin"
  end
end
