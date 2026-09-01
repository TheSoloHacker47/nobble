class AdminPolicy
  def allow?(user)
    return false if user.nil?
    user.role == "admin"
  end
end
