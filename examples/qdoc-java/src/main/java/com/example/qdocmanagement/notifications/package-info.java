/**
 * Bounded context of the Notifications subsystem (area code NOT), a platform
 * subsystem and an open host: tells users what the other subsystems ask it to
 * tell them, such as a new QDoc, a new version or an assignment. Holds no
 * process of its own and knows nothing of the subsystems that call it.
 *
 * <p>Notifications depends on no other subsystem: it subscribes to no event and
 * refers to no building block of another subsystem. The other subsystems reach
 * it only by calling {@link com.example.qdocmanagement.notifications.NotificationService},
 * in the types this subsystem defines ({@code NotifyUsers}, {@code Recipient}).
 */
@Module("notifications")
package com.example.qdocmanagement.notifications;

import vision.noesis.annotations.Module;
